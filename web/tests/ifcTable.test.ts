// Extracting properties out of IFC and merging several files into one table.
// The failure that matters here is a silent one: a column that exists in one
// file and quietly swallows rows from another.
import { describe, expect, it } from "vitest";
import { parseIfc, parseStepValue } from "../src/ifc/parseIfc";
import {
  buildRows,
  columnCoverage,
  filterRows,
  propertyColumns,
  toCsv,
  type IfcSource,
} from "../src/application/ifcTable";

/** One wall with a property set and an element quantity, in real IFC-SPF. */
function ifcWithProperties(name: string, psetName: string, extra = ""): string {
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION((''),'');
FILE_NAME('${name}','',(''),(''),'','','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCCARTESIANPOINT((0.,0.,0.));
#2=IFCAXIS2PLACEMENT3D(#1,$,$);
#3=IFCLOCALPLACEMENT($,#2);
#10=IFCPOLYLINE((#11,#12,#13,#14));
#11=IFCCARTESIANPOINT((0.,0.));
#12=IFCCARTESIANPOINT((4.,0.));
#13=IFCCARTESIANPOINT((4.,0.2));
#14=IFCCARTESIANPOINT((0.,0.2));
#15=IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#10);
#16=IFCDIRECTION((0.,0.,1.));
#17=IFCEXTRUDEDAREASOLID(#15,#2,#16,3.);
#18=IFCSHAPEREPRESENTATION($,'Body','SweptSolid',(#17));
#19=IFCPRODUCTDEFINITIONSHAPE($,$,(#18));
#20=IFCWALL('0GUID${name}00000000000','','Tường A',$,$,#3,#19,$,$);
#30=IFCPROPERTYSINGLEVALUE('IsExternal',$,IFCBOOLEAN(.T.),$);
#31=IFCPROPERTYSINGLEVALUE('FireRating',$,IFCLABEL('EI 60'),$);
#32=IFCPROPERTYSET('2PSET000000000000000000','','${psetName}',$,(#30,#31));
#33=IFCRELDEFINESBYPROPERTIES('3REL000000000000000000','',$,$,(#20),#32);
#40=IFCQUANTITYAREA('NetSideArea',$,$,11.4,$);
#41=IFCELEMENTQUANTITY('4QTO000000000000000000','','Qto_WallBaseQuantities',$,$,(#40));
#42=IFCRELDEFINESBYPROPERTIES('5REL000000000000000000','',$,$,(#20),#41);
${extra}
ENDSEC;
END-ISO-10303-21;
`;
}

describe("parseStepValue", () => {
  it("unwraps typed values", () => {
    expect(parseStepValue("IFCBOOLEAN(.T.)")).toBe(true);
    expect(parseStepValue("IFCBOOLEAN(.F.)")).toBe(false);
    expect(parseStepValue("IFCLABEL('EI 60')")).toBe("EI 60");
    expect(parseStepValue("IFCLENGTHMEASURE(2.5)")).toBe(2.5);
    expect(parseStepValue("'plain'")).toBe("plain");
    expect(parseStepValue("12")).toBe(12);
  });

  it("returns nothing for unset, rather than the string '$'", () => {
    expect(parseStepValue("$")).toBeUndefined();
    expect(parseStepValue("*")).toBeUndefined();
    expect(parseStepValue("")).toBeUndefined();
  });

  it("un-doubles the STEP apostrophe escape", () => {
    expect(parseStepValue("IFCLABEL('Bê tông d''''ầm')")).toContain("'");
  });
});

describe("parseIfc properties", () => {
  it("reads property sets and quantities onto the element", () => {
    const parsed = parseIfc(ifcWithProperties("KT", "Pset_WallCommon"));
    expect(parsed.elements).toHaveLength(1);
    const props = parsed.elements[0].properties ?? {};
    expect(props["Pset_WallCommon.IsExternal"]).toBe(true);
    expect(props["Pset_WallCommon.FireRating"]).toBe("EI 60");
    expect(props["Qto_WallBaseQuantities.NetSideArea"]).toBe(11.4);
  });

  it("keeps the GlobalId — the only handle back to the authoring tool", () => {
    const parsed = parseIfc(ifcWithProperties("KT", "Pset_WallCommon"));
    expect(parsed.elements[0].globalId).toMatch(/^0GUID/);
  });

  it("still parses a file with no properties at all", () => {
    const geometryOnly = ifcWithProperties("KC", "Pset_WallCommon")
      .split("\n")
      .filter((line) => !/IFCPROPERTY|IFCRELDEFINES|IFCQUANTITY|IFCELEMENTQUANTITY/.test(line))
      .join("\n");
    const parsed = parseIfc(geometryOnly);
    expect(parsed.elements).toHaveLength(1);
    expect(parsed.elements[0].properties).toBeUndefined();
  });
});

function sources(): IfcSource[] {
  return [
    { name: "KT.ifc", elements: parseIfc(ifcWithProperties("KT", "Pset_WallCommon")).elements },
    { name: "KC.ifc", elements: parseIfc(ifcWithProperties("KC", "Pset_ConcreteCommon")).elements },
  ];
}

describe("combining models", () => {
  it("unions columns across files instead of taking the first file's", () => {
    const columns = propertyColumns(sources());
    expect(columns).toContain("Pset_WallCommon.IsExternal");
    expect(columns).toContain("Pset_ConcreteCommon.IsExternal");
  });

  it("sorts columns, so re-linking a file does not reshuffle the table", () => {
    const forward = propertyColumns(sources());
    const backward = propertyColumns([...sources()].reverse());
    expect(forward).toEqual(backward);
  });

  /** The row must survive; only the cell is blank. */
  it("leaves a missing property blank rather than dropping the row", () => {
    const rows = buildRows(sources());
    expect(rows).toHaveLength(2);
    const fromKc = rows.find((row) => row.Model === "KC.ifc")!;
    expect(fromKc["Pset_WallCommon.IsExternal"]).toBeUndefined();
    expect(fromKc["Pset_ConcreteCommon.IsExternal"]).toBe(true);
  });

  it("names the source model on every row", () => {
    expect(new Set(buildRows(sources()).map((row) => row.Model))).toEqual(
      new Set(["KT.ifc", "KC.ifc"]),
    );
  });
});

describe("columnCoverage", () => {
  /**
   * Both files carry Qto_WallBaseQuantities but different Psets, so coverage
   * is what separates a column shared across disciplines from one that only
   * exists in a single file — which is the whole reason to rank them.
   */
  it("ranks a shared column above a file-specific one", () => {
    const rows = buildRows(sources());
    const coverage = columnCoverage(rows, propertyColumns(sources()));
    const shared = coverage.find((entry) => entry.column.startsWith("Qto_"))!;
    const specific = coverage.find((entry) => entry.column === "Pset_WallCommon.FireRating")!;

    expect(shared.filled).toBe(2);
    expect(specific.filled).toBe(1);
    expect(coverage[0].filled).toBeGreaterThanOrEqual(coverage.at(-1)!.filled);
    expect(coverage.every((entry) => entry.total === 2)).toBe(true);
  });
});

describe("filterRows", () => {
  it("matches on any visible column", () => {
    const rows = buildRows(sources());
    expect(filterRows(rows, ["Model"], "KC")).toHaveLength(1);
    expect(filterRows(rows, ["Model"], "")).toHaveLength(2);
  });

  it("does not match a column that is hidden", () => {
    const rows = buildRows(sources());
    expect(filterRows(rows, ["Model"], "EI 60")).toHaveLength(0);
    expect(filterRows(rows, ["Model", "Pset_WallCommon.FireRating"], "EI 60")).toHaveLength(1);
  });
});

describe("toCsv", () => {
  it("writes a header plus one line per row", () => {
    const csv = toCsv(buildRows(sources()), ["Model", "IfcType"]);
    expect(csv.split("\n")).toHaveLength(3);
    expect(csv.split("\n")[0]).toBe("Model,IfcType");
  });

  it("quotes cells containing a comma or a quote, per RFC 4180", () => {
    const csv = toCsv([{ A: 'x,y', B: 'say "hi"' }], ["A", "B"]);
    expect(csv.split("\n")[1]).toBe('"x,y","say ""hi"""');
  });

  it("writes an empty cell for a missing value, not 'undefined'", () => {
    expect(toCsv([{ A: undefined }], ["A"]).split("\n")[1]).toBe("");
  });
});
