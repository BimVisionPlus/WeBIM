
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.OrganizationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  mst: 'mst',
  type: 'type',
  address: 'address',
  phone: 'phone',
  email: 'email',
  isBetaApproved: 'isBetaApproved',
  createdAt: 'createdAt'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  emailVerified: 'emailVerified',
  name: 'name',
  phone: 'phone',
  passwordHash: 'passwordHash',
  caCertSerial: 'caCertSerial',
  avatarUrl: 'avatarUrl',
  isSuperAdmin: 'isSuperAdmin',
  lockedUntil: 'lockedUntil',
  failedLogins: 'failedLogins',
  createdAt: 'createdAt'
};

exports.Prisma.AccountScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  provider: 'provider',
  providerAccountId: 'providerAccountId',
  refresh_token: 'refresh_token',
  access_token: 'access_token',
  expires_at: 'expires_at',
  token_type: 'token_type',
  scope: 'scope',
  id_token: 'id_token',
  session_state: 'session_state'
};

exports.Prisma.SessionScalarFieldEnum = {
  id: 'id',
  sessionToken: 'sessionToken',
  userId: 'userId',
  expires: 'expires',
  ip: 'ip',
  userAgent: 'userAgent'
};

exports.Prisma.VerificationTokenScalarFieldEnum = {
  identifier: 'identifier',
  token: 'token',
  expires: 'expires'
};

exports.Prisma.PasswordResetTokenScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  tokenHash: 'tokenHash',
  expiresAt: 'expiresAt',
  usedAt: 'usedAt',
  createdAt: 'createdAt'
};

exports.Prisma.MembershipScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  orgId: 'orgId',
  role: 'role'
};

exports.Prisma.ProjectScalarFieldEnum = {
  id: 'id',
  key: 'key',
  name: 'name',
  ownerOrgId: 'ownerOrgId',
  address: 'address',
  province: 'province',
  district: 'district',
  contractValueVnd: 'contractValueVnd',
  startDate: 'startDate',
  endDate: 'endDate',
  status: 'status',
  permitNumber: 'permitNumber',
  permitDate: 'permitDate',
  warrantyMonths: 'warrantyMonths',
  createdAt: 'createdAt'
};

exports.Prisma.ProjectStakeholderScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  orgId: 'orgId',
  role: 'role'
};

exports.Prisma.IssueScalarFieldEnum = {
  id: 'id',
  key: 'key',
  projectId: 'projectId',
  type: 'type',
  title: 'title',
  description: 'description',
  state: 'state',
  priority: 'priority',
  reporterId: 'reporterId',
  assigneeId: 'assigneeId',
  dueDate: 'dueDate',
  locationZone: 'locationZone',
  sheetId: 'sheetId',
  positionX: 'positionX',
  positionY: 'positionY',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  closedAt: 'closedAt'
};

exports.Prisma.TransitionScalarFieldEnum = {
  id: 'id',
  issueId: 'issueId',
  fromState: 'fromState',
  toState: 'toState',
  byUserId: 'byUserId',
  reason: 'reason',
  createdAt: 'createdAt'
};

exports.Prisma.CommentScalarFieldEnum = {
  id: 'id',
  issueId: 'issueId',
  authorId: 'authorId',
  body: 'body',
  createdAt: 'createdAt'
};

exports.Prisma.RFIScalarFieldEnum = {
  issueId: 'issueId',
  question: 'question',
  category: 'category',
  requestedById: 'requestedById',
  respondedById: 'respondedById',
  answer: 'answer',
  costImpactVnd: 'costImpactVnd',
  scheduleImpactDays: 'scheduleImpactDays',
  needBy: 'needBy',
  answeredAt: 'answeredAt',
  projectId: 'projectId'
};

exports.Prisma.SubmittalScalarFieldEnum = {
  issueId: 'issueId',
  specSection: 'specSection',
  materialName: 'materialName',
  manufacturer: 'manufacturer',
  submitterOrgId: 'submitterOrgId',
  reviewerOrgId: 'reviewerOrgId',
  revision: 'revision',
  decision: 'decision',
  decidedAt: 'decidedAt',
  projectId: 'projectId'
};

exports.Prisma.NCRScalarFieldEnum = {
  issueId: 'issueId',
  severity: 'severity',
  rootCause: 'rootCause',
  correctiveAction: 'correctiveAction',
  preventiveAction: 'preventiveAction',
  raisedByOrgId: 'raisedByOrgId',
  responsibleOrgId: 'responsibleOrgId',
  costImpactVnd: 'costImpactVnd',
  qcvnRef: 'qcvnRef',
  rectifiedAt: 'rectifiedAt',
  verifiedAt: 'verifiedAt',
  projectId: 'projectId'
};

exports.Prisma.PunchItemScalarFieldEnum = {
  issueId: 'issueId',
  trade: 'trade',
  zone: 'zone',
  photoBeforeUrl: 'photoBeforeUrl',
  photoAfterUrl: 'photoAfterUrl',
  acceptedAt: 'acceptedAt',
  projectId: 'projectId'
};

exports.Prisma.ChangeOrderScalarFieldEnum = {
  issueId: 'issueId',
  reason: 'reason',
  scopeChange: 'scopeChange',
  costDeltaVnd: 'costDeltaVnd',
  scheduleDeltaDays: 'scheduleDeltaDays',
  approvedAt: 'approvedAt',
  approvedByUserId: 'approvedByUserId',
  projectId: 'projectId'
};

exports.Prisma.DailyLogScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  date: 'date',
  authorId: 'authorId',
  weather: 'weather',
  shift: 'shift',
  workforce: 'workforce',
  workDone: 'workDone',
  workTomorrow: 'workTomorrow',
  safetyNotes: 'safetyNotes',
  signoffByCdtId: 'signoffByCdtId',
  signoffByGsId: 'signoffByGsId',
  signedAt: 'signedAt',
  createdAt: 'createdAt'
};

exports.Prisma.DrawingSetScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  name: 'name',
  discipline: 'discipline',
  issuedDate: 'issuedDate',
  revision: 'revision',
  isCurrent: 'isCurrent',
  createdAt: 'createdAt'
};

exports.Prisma.SheetScalarFieldEnum = {
  id: 'id',
  drawingSetId: 'drawingSetId',
  sheetNumber: 'sheetNumber',
  title: 'title',
  scale: 'scale',
  fileUrl: 'fileUrl',
  thumbnailUrl: 'thumbnailUrl',
  pageNumber: 'pageNumber',
  revision: 'revision',
  supersededById: 'supersededById'
};

exports.Prisma.MarkupScalarFieldEnum = {
  id: 'id',
  sheetId: 'sheetId',
  authorId: 'authorId',
  geometry: 'geometry',
  color: 'color',
  label: 'label',
  createdAt: 'createdAt'
};

exports.Prisma.ModelScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  name: 'name',
  discipline: 'discipline',
  fileUrl: 'fileUrl',
  fileSizeBytes: 'fileSizeBytes',
  format: 'format',
  apsUrn: 'apsUrn',
  apsTranslationStatus: 'apsTranslationStatus',
  apsTranslationProgress: 'apsTranslationProgress',
  revision: 'revision',
  uploadedByUserId: 'uploadedByUserId',
  uploadedAt: 'uploadedAt'
};

exports.Prisma.AcceptanceScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  type: 'type',
  code: 'code',
  title: 'title',
  state: 'state',
  scheduledAt: 'scheduledAt',
  conductedAt: 'conductedAt',
  finalizedAt: 'finalizedAt',
  rejectionNote: 'rejectionNote',
  qcvnRefs: 'qcvnRefs',
  testResults: 'testResults'
};

exports.Prisma.SignoffScalarFieldEnum = {
  id: 'id',
  acceptanceId: 'acceptanceId',
  userId: 'userId',
  role: 'role',
  signedAt: 'signedAt',
  signatureUrl: 'signatureUrl',
  caCertSerial: 'caCertSerial',
  rejected: 'rejected',
  rejectNote: 'rejectNote'
};

exports.Prisma.ProgressPaymentScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  period: 'period',
  workDoneVnd: 'workDoneVnd',
  vatRate: 'vatRate',
  vatVnd: 'vatVnd',
  retentionPct: 'retentionPct',
  retentionVnd: 'retentionVnd',
  cumulativeVnd: 'cumulativeVnd',
  state: 'state',
  submittedAt: 'submittedAt',
  approvedAt: 'approvedAt',
  paidAt: 'paidAt'
};

exports.Prisma.SpecPageScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  slug: 'slug',
  title: 'title',
  body: 'body',
  parentId: 'parentId',
  authorId: 'authorId',
  embedding: 'embedding',
  embeddedAt: 'embeddedAt',
  embedModel: 'embedModel',
  updatedAt: 'updatedAt',
  createdAt: 'createdAt'
};

exports.Prisma.AttachmentScalarFieldEnum = {
  id: 'id',
  fileUrl: 'fileUrl',
  fileName: 'fileName',
  contentType: 'contentType',
  sizeBytes: 'sizeBytes',
  uploadedAt: 'uploadedAt',
  issueId: 'issueId',
  dailyLogId: 'dailyLogId',
  acceptanceId: 'acceptanceId',
  bidId: 'bidId',
  incidentId: 'incidentId'
};

exports.Prisma.AiSuggestionScalarFieldEnum = {
  id: 'id',
  kind: 'kind',
  entityType: 'entityType',
  entityId: 'entityId',
  projectId: 'projectId',
  model: 'model',
  ok: 'ok',
  failReason: 'failReason',
  output: 'output',
  latencyMs: 'latencyMs',
  accepted: 'accepted',
  acceptedAt: 'acceptedAt',
  createdAt: 'createdAt'
};

exports.Prisma.WaitlistEntryScalarFieldEnum = {
  id: 'id',
  email: 'email',
  name: 'name',
  company: 'company',
  role: 'role',
  size: 'size',
  notes: 'notes',
  source: 'source',
  createdAt: 'createdAt'
};

exports.Prisma.InviteScalarFieldEnum = {
  id: 'id',
  email: 'email',
  orgId: 'orgId',
  projectId: 'projectId',
  role: 'role',
  invitedById: 'invitedById',
  tokenHash: 'tokenHash',
  expiresAt: 'expiresAt',
  acceptedAt: 'acceptedAt',
  revokedAt: 'revokedAt',
  createdAt: 'createdAt'
};

exports.Prisma.AuditEventScalarFieldEnum = {
  id: 'id',
  orgId: 'orgId',
  projectId: 'projectId',
  actorId: 'actorId',
  action: 'action',
  entityType: 'entityType',
  entityId: 'entityId',
  ip: 'ip',
  userAgent: 'userAgent',
  before: 'before',
  after: 'after',
  createdAt: 'createdAt'
};

exports.Prisma.TenderOpportunityScalarFieldEnum = {
  id: 'id',
  source: 'source',
  sourceUrl: 'sourceUrl',
  sourceRef: 'sourceRef',
  title: 'title',
  invitor: 'invitor',
  invitorMst: 'invitorMst',
  budgetVnd: 'budgetVnd',
  fundingSource: 'fundingSource',
  category: 'category',
  province: 'province',
  district: 'district',
  publishedAt: 'publishedAt',
  closingAt: 'closingAt',
  openingAt: 'openingAt',
  bidMethod: 'bidMethod',
  bidForm: 'bidForm',
  contractType: 'contractType',
  rawHash: 'rawHash',
  rawJson: 'rawJson',
  scrapedAt: 'scrapedAt'
};

exports.Prisma.BidScalarFieldEnum = {
  id: 'id',
  key: 'key',
  orgId: 'orgId',
  opportunityId: 'opportunityId',
  projectId: 'projectId',
  title: 'title',
  state: 'state',
  ownerUserId: 'ownerUserId',
  estimatedValueVnd: 'estimatedValueVnd',
  proposedValueVnd: 'proposedValueVnd',
  marginPct: 'marginPct',
  contingencyPct: 'contingencyPct',
  technicalScore: 'technicalScore',
  financialScore: 'financialScore',
  winProbability: 'winProbability',
  submittedAt: 'submittedAt',
  decisionAt: 'decisionAt',
  outcome: 'outcome',
  outcomeNote: 'outcomeNote',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BidBondScalarFieldEnum = {
  id: 'id',
  bidId: 'bidId',
  type: 'type',
  issuerBank: 'issuerBank',
  bondNumber: 'bondNumber',
  amountVnd: 'amountVnd',
  issuedAt: 'issuedAt',
  expiresAt: 'expiresAt',
  feeVnd: 'feeVnd',
  status: 'status',
  releasedAt: 'releasedAt',
  fileUrl: 'fileUrl',
  createdAt: 'createdAt'
};

exports.Prisma.BidComplianceCheckScalarFieldEnum = {
  id: 'id',
  bidId: 'bidId',
  ruleId: 'ruleId',
  ruleVersion: 'ruleVersion',
  ruleTitle: 'ruleTitle',
  ruleRef: 'ruleRef',
  severity: 'severity',
  status: 'status',
  evidence: 'evidence',
  note: 'note',
  checkedAt: 'checkedAt'
};

exports.Prisma.RegulationScalarFieldEnum = {
  id: 'id',
  code: 'code',
  kind: 'kind',
  title: 'title',
  body: 'body',
  issuedBy: 'issuedBy',
  effectiveAt: 'effectiveAt',
  expiresAt: 'expiresAt',
  supersedes: 'supersedes',
  url: 'url',
  status: 'status',
  tags: 'tags',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProjectRegulationScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  regulationId: 'regulationId',
  required: 'required',
  note: 'note',
  createdAt: 'createdAt'
};

exports.Prisma.CodeRuleScalarFieldEnum = {
  id: 'id',
  regulationId: 'regulationId',
  code: 'code',
  clauseRef: 'clauseRef',
  title: 'title',
  description: 'description',
  severity: 'severity',
  category: 'category',
  check: 'check',
  isActive: 'isActive',
  createdAt: 'createdAt'
};

exports.Prisma.CodeRuleFindingScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  ruleId: 'ruleId',
  entityType: 'entityType',
  entityId: 'entityId',
  status: 'status',
  evidence: 'evidence',
  note: 'note',
  resolvedAt: 'resolvedAt',
  createdAt: 'createdAt'
};

exports.Prisma.QualityDossierItemScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  category: 'category',
  itemCode: 'itemCode',
  itemTitle: 'itemTitle',
  required: 'required',
  status: 'status',
  evidenceUrl: 'evidenceUrl',
  uploadedAt: 'uploadedAt',
  reviewedAt: 'reviewedAt',
  reviewerId: 'reviewerId',
  note: 'note',
  createdAt: 'createdAt'
};

exports.Prisma.ModelElementScalarFieldEnum = {
  id: 'id',
  modelId: 'modelId',
  elementId: 'elementId',
  name: 'name',
  category: 'category',
  discipline: 'discipline',
  level: 'level',
  zone: 'zone',
  ifcType: 'ifcType',
  bbox: 'bbox',
  properties: 'properties',
  createdAt: 'createdAt'
};

exports.Prisma.ClashScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  elementAId: 'elementAId',
  elementBId: 'elementBId',
  category: 'category',
  description: 'description',
  severity: 'severity',
  status: 'status',
  detectedAt: 'detectedAt',
  resolvedAt: 'resolvedAt',
  issueId: 'issueId'
};

exports.Prisma.IssueElementLinkScalarFieldEnum = {
  id: 'id',
  issueId: 'issueId',
  elementId: 'elementId',
  note: 'note',
  createdAt: 'createdAt'
};

exports.Prisma.SiteCameraScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  name: 'name',
  streamUrl: 'streamUrl',
  location: 'location',
  lat: 'lat',
  lng: 'lng',
  active: 'active',
  createdAt: 'createdAt'
};

exports.Prisma.VisionEventScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  cameraId: 'cameraId',
  kind: 'kind',
  ts: 'ts',
  confidence: 'confidence',
  bbox: 'bbox',
  label: 'label',
  frameUrl: 'frameUrl',
  payload: 'payload',
  reviewedBy: 'reviewedBy',
  reviewedAt: 'reviewedAt',
  acknowledged: 'acknowledged'
};

exports.Prisma.WeatherSnapshotScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  ts: 'ts',
  tempC: 'tempC',
  humidity: 'humidity',
  rainMmHr: 'rainMmHr',
  windKph: 'windKph',
  condition: 'condition',
  source: 'source',
  payload: 'payload'
};

exports.Prisma.IncidentReportScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  reporterId: 'reporterId',
  occurredAt: 'occurredAt',
  reportedAt: 'reportedAt',
  category: 'category',
  severity: 'severity',
  description: 'description',
  location: 'location',
  injured: 'injured',
  rootCause: 'rootCause',
  immediateAction: 'immediateAction',
  preventiveAction: 'preventiveAction',
  closedAt: 'closedAt',
  issueId: 'issueId'
};

exports.Prisma.BoQScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  name: 'name',
  contractValueVnd: 'contractValueVnd',
  version: 'version',
  isCurrent: 'isCurrent',
  createdAt: 'createdAt'
};

exports.Prisma.BoQLineScalarFieldEnum = {
  id: 'id',
  boqId: 'boqId',
  code: 'code',
  description: 'description',
  unit: 'unit',
  qty: 'qty',
  unitPriceVnd: 'unitPriceVnd',
  totalVnd: 'totalVnd',
  qtyCompleted: 'qtyCompleted',
  category: 'category',
  costCode: 'costCode',
  createdAt: 'createdAt'
};

exports.Prisma.MaterialPriceIndexScalarFieldEnum = {
  id: 'id',
  province: 'province',
  material: 'material',
  unit: 'unit',
  priceVnd: 'priceVnd',
  period: 'period',
  source: 'source',
  createdAt: 'createdAt'
};

exports.Prisma.SubcontractorScoreScalarFieldEnum = {
  id: 'id',
  orgId: 'orgId',
  projectId: 'projectId',
  period: 'period',
  priceScore: 'priceScore',
  qualityScore: 'qualityScore',
  scheduleScore: 'scheduleScore',
  safetyScore: 'safetyScore',
  overallScore: 'overallScore',
  note: 'note',
  createdAt: 'createdAt'
};

exports.Prisma.CostOverrunSignalScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  category: 'category',
  forecastedVnd: 'forecastedVnd',
  baselineVnd: 'baselineVnd',
  deltaPct: 'deltaPct',
  weeksAhead: 'weeksAhead',
  severity: 'severity',
  status: 'status',
  evidence: 'evidence',
  createdAt: 'createdAt'
};

exports.Prisma.WorkflowTemplateScalarFieldEnum = {
  id: 'id',
  orgId: 'orgId',
  name: 'name',
  scope: 'scope',
  description: 'description',
  dag: 'dag',
  version: 'version',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RecurringTaskScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  name: 'name',
  template: 'template',
  cron: 'cron',
  active: 'active',
  lastFiredAt: 'lastFiredAt',
  nextFireAt: 'nextFireAt',
  createdAt: 'createdAt'
};

exports.Prisma.ChatChannelScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  orgId: 'orgId',
  name: 'name',
  topic: 'topic',
  isPrivate: 'isPrivate',
  createdAt: 'createdAt'
};

exports.Prisma.ChatMessageScalarFieldEnum = {
  id: 'id',
  channelId: 'channelId',
  authorId: 'authorId',
  body: 'body',
  threadId: 'threadId',
  attachments: 'attachments',
  createdAt: 'createdAt'
};

exports.Prisma.SlaBreachScalarFieldEnum = {
  id: 'id',
  issueId: 'issueId',
  workflowId: 'workflowId',
  stepKey: 'stepKey',
  dueAt: 'dueAt',
  breachedAt: 'breachedAt',
  escalatedTo: 'escalatedTo',
  resolvedAt: 'resolvedAt'
};

exports.Prisma.AgentScalarFieldEnum = {
  id: 'id',
  orgId: 'orgId',
  name: 'name',
  systemPrompt: 'systemPrompt',
  model: 'model',
  tools: 'tools',
  escalationTier: 'escalationTier',
  enabled: 'enabled',
  createdAt: 'createdAt'
};

exports.Prisma.AgentRunScalarFieldEnum = {
  id: 'id',
  agentId: 'agentId',
  projectId: 'projectId',
  userId: 'userId',
  goal: 'goal',
  plan: 'plan',
  steps: 'steps',
  result: 'result',
  status: 'status',
  errorReason: 'errorReason',
  startedAt: 'startedAt',
  endedAt: 'endedAt'
};

exports.Prisma.AgentMemoryScalarFieldEnum = {
  id: 'id',
  agentId: 'agentId',
  projectId: 'projectId',
  key: 'key',
  value: 'value',
  updatedAt: 'updatedAt',
  createdAt: 'createdAt'
};

exports.Prisma.ModelCardScalarFieldEnum = {
  id: 'id',
  feature: 'feature',
  modelName: 'modelName',
  modelVersion: 'modelVersion',
  trainingDataSummary: 'trainingDataSummary',
  intendedUse: 'intendedUse',
  limitations: 'limitations',
  benchmarkResults: 'benchmarkResults',
  datasetCitations: 'datasetCitations',
  fairnessSummary: 'fairnessSummary',
  publishedAt: 'publishedAt'
};

exports.Prisma.AiCitationScalarFieldEnum = {
  id: 'id',
  suggestionId: 'suggestionId',
  claim: 'claim',
  sourceType: 'sourceType',
  sourceId: 'sourceId',
  sourceQuote: 'sourceQuote',
  confidence: 'confidence',
  createdAt: 'createdAt'
};

exports.Prisma.ExplanationRequestScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  suggestionId: 'suggestionId',
  question: 'question',
  explanation: 'explanation',
  answeredAt: 'answeredAt',
  createdAt: 'createdAt'
};

exports.Prisma.DriftSnapshotScalarFieldEnum = {
  id: 'id',
  feature: 'feature',
  modelVersion: 'modelVersion',
  windowStart: 'windowStart',
  windowEnd: 'windowEnd',
  inputKLDiv: 'inputKLDiv',
  outputKLDiv: 'outputKLDiv',
  acceptanceRate: 'acceptanceRate',
  stabilityScore: 'stabilityScore',
  alertLevel: 'alertLevel',
  payload: 'payload',
  createdAt: 'createdAt'
};

exports.Prisma.DataLineageScalarFieldEnum = {
  id: 'id',
  modelCardId: 'modelCardId',
  datasetRef: 'datasetRef',
  rows: 'rows',
  hash: 'hash',
  collectedAt: 'collectedAt',
  notes: 'notes'
};

exports.Prisma.BiasAuditScalarFieldEnum = {
  id: 'id',
  feature: 'feature',
  modelVersion: 'modelVersion',
  dimension: 'dimension',
  results: 'results',
  alertLevel: 'alertLevel',
  auditedAt: 'auditedAt'
};

exports.Prisma.AiCostEventScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  feature: 'feature',
  model: 'model',
  tokensIn: 'tokensIn',
  tokensOut: 'tokensOut',
  latencyMs: 'latencyMs',
  costVnd: 'costVnd',
  occurredAt: 'occurredAt'
};

exports.Prisma.ZaloIdentityScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  zaloUserId: 'zaloUserId',
  phone: 'phone',
  oaFollowerId: 'oaFollowerId',
  linkedAt: 'linkedAt'
};

exports.Prisma.OutboundMessageScalarFieldEnum = {
  id: 'id',
  channel: 'channel',
  toRef: 'toRef',
  template: 'template',
  body: 'body',
  status: 'status',
  providerId: 'providerId',
  errorReason: 'errorReason',
  sentAt: 'sentAt',
  createdAt: 'createdAt'
};

exports.Prisma.EInvoiceScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  paymentId: 'paymentId',
  invoiceNumber: 'invoiceNumber',
  serialNumber: 'serialNumber',
  templateNumber: 'templateNumber',
  issueDate: 'issueDate',
  buyerName: 'buyerName',
  buyerMst: 'buyerMst',
  sellerName: 'sellerName',
  sellerMst: 'sellerMst',
  subtotalVnd: 'subtotalVnd',
  vatRate: 'vatRate',
  vatVnd: 'vatVnd',
  totalVnd: 'totalVnd',
  cqtCode: 'cqtCode',
  cqtStatus: 'cqtStatus',
  xmlPayload: 'xmlPayload',
  pdfUrl: 'pdfUrl',
  createdAt: 'createdAt'
};

exports.Prisma.FengShuiAnalysisScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  unitCode: 'unitCode',
  facingDirection: 'facingDirection',
  ownerBirthYear: 'ownerBirthYear',
  menh: 'menh',
  cungMenh: 'cungMenh',
  scoreOverall: 'scoreOverall',
  findings: 'findings',
  modelVersion: 'modelVersion',
  createdAt: 'createdAt'
};

exports.Prisma.IdCardScanScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  cardType: 'cardType',
  number: 'number',
  fullName: 'fullName',
  dob: 'dob',
  address: 'address',
  issuedAt: 'issuedAt',
  expiresAt: 'expiresAt',
  imageUrl: 'imageUrl',
  ocrConfidence: 'ocrConfidence',
  createdAt: 'createdAt'
};

exports.Prisma.LunarEventScalarFieldEnum = {
  id: 'id',
  date: 'date',
  lunarDate: 'lunarDate',
  category: 'category',
  good: 'good',
  note: 'note'
};

exports.Prisma.ApiKeyScalarFieldEnum = {
  id: 'id',
  orgId: 'orgId',
  name: 'name',
  keyHash: 'keyHash',
  prefix: 'prefix',
  scopes: 'scopes',
  expiresAt: 'expiresAt',
  lastUsedAt: 'lastUsedAt',
  revokedAt: 'revokedAt',
  createdAt: 'createdAt'
};

exports.Prisma.WebhookScalarFieldEnum = {
  id: 'id',
  orgId: 'orgId',
  name: 'name',
  url: 'url',
  events: 'events',
  secret: 'secret',
  active: 'active',
  failureCount: 'failureCount',
  lastDeliveryAt: 'lastDeliveryAt',
  createdAt: 'createdAt'
};

exports.Prisma.WebhookDeliveryScalarFieldEnum = {
  id: 'id',
  webhookId: 'webhookId',
  event: 'event',
  payload: 'payload',
  attempt: 'attempt',
  responseCode: 'responseCode',
  responseBody: 'responseBody',
  ok: 'ok',
  deliveredAt: 'deliveredAt'
};

exports.Prisma.ConnectorScalarFieldEnum = {
  id: 'id',
  orgId: 'orgId',
  system: 'system',
  displayName: 'displayName',
  credentialsEnc: 'credentialsEnc',
  config: 'config',
  active: 'active',
  lastSyncAt: 'lastSyncAt',
  status: 'status',
  errorReason: 'errorReason',
  createdAt: 'createdAt'
};

exports.Prisma.DevicePushTokenScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  platform: 'platform',
  token: 'token',
  active: 'active',
  createdAt: 'createdAt',
  lastSeenAt: 'lastSeenAt'
};

exports.Prisma.OfflineSyncOpScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  deviceId: 'deviceId',
  opType: 'opType',
  payload: 'payload',
  appliedAt: 'appliedAt',
  status: 'status',
  errorReason: 'errorReason',
  createdAt: 'createdAt'
};

exports.Prisma.PlanScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  pricingJson: 'pricingJson',
  features: 'features',
  isActive: 'isActive',
  createdAt: 'createdAt'
};

exports.Prisma.SubscriptionScalarFieldEnum = {
  id: 'id',
  orgId: 'orgId',
  planId: 'planId',
  startedAt: 'startedAt',
  renewsAt: 'renewsAt',
  cancelledAt: 'cancelledAt',
  aiCreditVnd: 'aiCreditVnd',
  paymentMethod: 'paymentMethod',
  status: 'status'
};

exports.Prisma.NpsResponseScalarFieldEnum = {
  id: 'id',
  orgId: 'orgId',
  userId: 'userId',
  score: 'score',
  comment: 'comment',
  segment: 'segment',
  surveyKey: 'surveyKey',
  createdAt: 'createdAt'
};

exports.Prisma.ReferralScalarFieldEnum = {
  id: 'id',
  referrerOrgId: 'referrerOrgId',
  code: 'code',
  inviteeEmail: 'inviteeEmail',
  signedUpOrgId: 'signedUpOrgId',
  rewardVnd: 'rewardVnd',
  rewardPaid: 'rewardPaid',
  createdAt: 'createdAt'
};

exports.Prisma.TemplateListingScalarFieldEnum = {
  id: 'id',
  authorOrgId: 'authorOrgId',
  kind: 'kind',
  title: 'title',
  description: 'description',
  payload: 'payload',
  priceVnd: 'priceVnd',
  downloads: 'downloads',
  rating: 'rating',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.OrgType = exports.$Enums.OrgType = {
  CHU_DAU_TU: 'CHU_DAU_TU',
  TU_VAN_GIAM_SAT: 'TU_VAN_GIAM_SAT',
  TU_VAN_THIET_KE: 'TU_VAN_THIET_KE',
  NHA_THAU_CHINH: 'NHA_THAU_CHINH',
  NHA_THAU_PHU: 'NHA_THAU_PHU',
  NHA_CUNG_CAP: 'NHA_CUNG_CAP',
  CO_QUAN_NHA_NUOC: 'CO_QUAN_NHA_NUOC'
};

exports.MemberRole = exports.$Enums.MemberRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  PROJECT_MGR: 'PROJECT_MGR',
  ENGINEER: 'ENGINEER',
  SUPERVISOR: 'SUPERVISOR',
  FIELD: 'FIELD',
  VIEWER: 'VIEWER'
};

exports.ProjectStatus = exports.$Enums.ProjectStatus = {
  PLANNING: 'PLANNING',
  IN_PROGRESS: 'IN_PROGRESS',
  HANDOVER: 'HANDOVER',
  WARRANTY: 'WARRANTY',
  CLOSED: 'CLOSED'
};

exports.IssueType = exports.$Enums.IssueType = {
  TASK: 'TASK',
  RFI: 'RFI',
  SUBMITTAL: 'SUBMITTAL',
  NCR: 'NCR',
  PUNCH: 'PUNCH',
  CHANGE_ORDER: 'CHANGE_ORDER',
  SAFETY: 'SAFETY'
};

exports.Priority = exports.$Enums.Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

exports.SubmittalDecision = exports.$Enums.SubmittalDecision = {
  APPROVED: 'APPROVED',
  APPROVED_AS_NOTED: 'APPROVED_AS_NOTED',
  REVISE_RESUBMIT: 'REVISE_RESUBMIT',
  REJECTED: 'REJECTED'
};

exports.NCRSeverity = exports.$Enums.NCRSeverity = {
  MINOR: 'MINOR',
  MAJOR: 'MAJOR',
  CRITICAL: 'CRITICAL'
};

exports.Shift = exports.$Enums.Shift = {
  DAY: 'DAY',
  NIGHT: 'NIGHT'
};

exports.Discipline = exports.$Enums.Discipline = {
  KIEN_TRUC: 'KIEN_TRUC',
  KET_CAU: 'KET_CAU',
  CO_DIEN_M: 'CO_DIEN_M',
  CO_DIEN_E: 'CO_DIEN_E',
  CO_DIEN_P: 'CO_DIEN_P',
  PCCC: 'PCCC',
  CANH_QUAN: 'CANH_QUAN',
  HA_TANG: 'HA_TANG',
  NOI_THAT: 'NOI_THAT'
};

exports.ModelFormat = exports.$Enums.ModelFormat = {
  IFC: 'IFC',
  RVT: 'RVT',
  NWD: 'NWD',
  NWC: 'NWC',
  DWG: 'DWG',
  DXF: 'DXF',
  PDF: 'PDF',
  OTHER: 'OTHER'
};

exports.TranslationStatus = exports.$Enums.TranslationStatus = {
  PENDING: 'PENDING',
  INPROGRESS: 'INPROGRESS',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  TIMEOUT: 'TIMEOUT'
};

exports.AcceptanceType = exports.$Enums.AcceptanceType = {
  CONG_VIEC: 'CONG_VIEC',
  GIAI_DOAN: 'GIAI_DOAN',
  HOAN_THANH: 'HOAN_THANH'
};

exports.TenderSource = exports.$Enums.TenderSource = {
  MUASAMCONG: 'MUASAMCONG',
  DAUTHAU_ASIA: 'DAUTHAU_ASIA',
  BAO_DAU_THAU: 'BAO_DAU_THAU',
  MANUAL: 'MANUAL',
  OTHER: 'OTHER'
};

exports.BidOutcome = exports.$Enums.BidOutcome = {
  AWARDED: 'AWARDED',
  LOST: 'LOST',
  CANCELLED: 'CANCELLED',
  WITHDRAWN: 'WITHDRAWN',
  PENDING: 'PENDING'
};

exports.BondType = exports.$Enums.BondType = {
  BAO_LANH_DU_THAU: 'BAO_LANH_DU_THAU',
  BAO_LANH_THUC_HIEN: 'BAO_LANH_THUC_HIEN',
  BAO_LANH_TAM_UNG: 'BAO_LANH_TAM_UNG',
  BAO_LANH_BAO_HANH: 'BAO_LANH_BAO_HANH'
};

exports.BondStatus = exports.$Enums.BondStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  RELEASED: 'RELEASED',
  CLAIMED: 'CLAIMED'
};

exports.ComplianceSeverity = exports.$Enums.ComplianceSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  BLOCKING: 'BLOCKING'
};

exports.ComplianceStatus = exports.$Enums.ComplianceStatus = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  NEEDS_REVIEW: 'NEEDS_REVIEW'
};

exports.RegulationKind = exports.$Enums.RegulationKind = {
  TCVN: 'TCVN',
  QCVN: 'QCVN',
  LUAT: 'LUAT',
  NGHI_DINH: 'NGHI_DINH',
  THONG_TU: 'THONG_TU',
  QUYET_DINH: 'QUYET_DINH',
  CONG_VAN: 'CONG_VAN'
};

exports.RegulationStatus = exports.$Enums.RegulationStatus = {
  DRAFT: 'DRAFT',
  IN_FORCE: 'IN_FORCE',
  SUSPENDED: 'SUSPENDED',
  SUPERSEDED: 'SUPERSEDED'
};

exports.CodeSeverity = exports.$Enums.CodeSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  BLOCKING: 'BLOCKING'
};

exports.DossierCategory = exports.$Enums.DossierCategory = {
  KHAO_SAT: 'KHAO_SAT',
  THIET_KE: 'THIET_KE',
  THI_CONG: 'THI_CONG',
  NGHIEM_THU: 'NGHIEM_THU',
  HOAN_CONG: 'HOAN_CONG'
};

exports.DossierStatus = exports.$Enums.DossierStatus = {
  MISSING: 'MISSING',
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED'
};

exports.ClashCategory = exports.$Enums.ClashCategory = {
  HARD: 'HARD',
  CLEARANCE: 'CLEARANCE',
  WORKFLOW: 'WORKFLOW'
};

exports.ClashStatus = exports.$Enums.ClashStatus = {
  OPEN: 'OPEN',
  TRIAGED: 'TRIAGED',
  RESOLVED: 'RESOLVED',
  IGNORED: 'IGNORED'
};

exports.VisionKind = exports.$Enums.VisionKind = {
  PPE_VIOLATION: 'PPE_VIOLATION',
  WORKER_COUNT: 'WORKER_COUNT',
  INTRUSION: 'INTRUSION',
  FIRE_SMOKE: 'FIRE_SMOKE',
  CRANE_SWING: 'CRANE_SWING',
  VEHICLE: 'VEHICLE'
};

exports.IncidentCategory = exports.$Enums.IncidentCategory = {
  AN_TOAN_LAO_DONG: 'AN_TOAN_LAO_DONG',
  CHAY_NO: 'CHAY_NO',
  SUP_DO: 'SUP_DO',
  ROI_NGA: 'ROI_NGA',
  DIEN_GIAT: 'DIEN_GIAT',
  HOA_CHAT: 'HOA_CHAT',
  MOI_TRUONG: 'MOI_TRUONG',
  KHAC: 'KHAC'
};

exports.IncidentSeverity = exports.$Enums.IncidentSeverity = {
  NEAR_MISS: 'NEAR_MISS',
  MINOR: 'MINOR',
  MAJOR: 'MAJOR',
  CRITICAL: 'CRITICAL'
};

exports.OverrunSeverity = exports.$Enums.OverrunSeverity = {
  WATCH: 'WATCH',
  ALERT: 'ALERT',
  CRITICAL: 'CRITICAL'
};

exports.OverrunStatus = exports.$Enums.OverrunStatus = {
  OPEN: 'OPEN',
  MITIGATING: 'MITIGATING',
  RESOLVED: 'RESOLVED',
  ACCEPTED_OVERRUN: 'ACCEPTED_OVERRUN'
};

exports.WorkflowScope = exports.$Enums.WorkflowScope = {
  ORG: 'ORG',
  PROJECT: 'PROJECT',
  PUBLIC: 'PUBLIC'
};

exports.AgentTier = exports.$Enums.AgentTier = {
  AUTO: 'AUTO',
  AUTO_REVIEW: 'AUTO_REVIEW',
  HUMAN_APPROVE: 'HUMAN_APPROVE'
};

exports.AgentRunStatus = exports.$Enums.AgentRunStatus = {
  PENDING: 'PENDING',
  PLANNING: 'PLANNING',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  EXECUTING: 'EXECUTING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

exports.DriftAlert = exports.$Enums.DriftAlert = {
  OK: 'OK',
  WATCH: 'WATCH',
  DEGRADED: 'DEGRADED',
  REQUIRES_RETRAIN: 'REQUIRES_RETRAIN'
};

exports.MsgChannel = exports.$Enums.MsgChannel = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  ZALO_OA: 'ZALO_OA',
  ZALO_MINI_APP: 'ZALO_MINI_APP',
  WHATSAPP: 'WHATSAPP',
  TELEGRAM: 'TELEGRAM',
  IN_APP: 'IN_APP'
};

exports.MsgStatus = exports.$Enums.MsgStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  BOUNCED: 'BOUNCED'
};

exports.TemplateKind = exports.$Enums.TemplateKind = {
  WORKFLOW: 'WORKFLOW',
  SPEC: 'SPEC',
  BOQ: 'BOQ',
  BIM_FAMILY: 'BIM_FAMILY',
  AGENT_SKILL: 'AGENT_SKILL',
  CHECKLIST: 'CHECKLIST'
};

exports.Prisma.ModelName = {
  Organization: 'Organization',
  User: 'User',
  Account: 'Account',
  Session: 'Session',
  VerificationToken: 'VerificationToken',
  PasswordResetToken: 'PasswordResetToken',
  Membership: 'Membership',
  Project: 'Project',
  ProjectStakeholder: 'ProjectStakeholder',
  Issue: 'Issue',
  Transition: 'Transition',
  Comment: 'Comment',
  RFI: 'RFI',
  Submittal: 'Submittal',
  NCR: 'NCR',
  PunchItem: 'PunchItem',
  ChangeOrder: 'ChangeOrder',
  DailyLog: 'DailyLog',
  DrawingSet: 'DrawingSet',
  Sheet: 'Sheet',
  Markup: 'Markup',
  Model: 'Model',
  Acceptance: 'Acceptance',
  Signoff: 'Signoff',
  ProgressPayment: 'ProgressPayment',
  SpecPage: 'SpecPage',
  Attachment: 'Attachment',
  AiSuggestion: 'AiSuggestion',
  WaitlistEntry: 'WaitlistEntry',
  Invite: 'Invite',
  AuditEvent: 'AuditEvent',
  TenderOpportunity: 'TenderOpportunity',
  Bid: 'Bid',
  BidBond: 'BidBond',
  BidComplianceCheck: 'BidComplianceCheck',
  Regulation: 'Regulation',
  ProjectRegulation: 'ProjectRegulation',
  CodeRule: 'CodeRule',
  CodeRuleFinding: 'CodeRuleFinding',
  QualityDossierItem: 'QualityDossierItem',
  ModelElement: 'ModelElement',
  Clash: 'Clash',
  IssueElementLink: 'IssueElementLink',
  SiteCamera: 'SiteCamera',
  VisionEvent: 'VisionEvent',
  WeatherSnapshot: 'WeatherSnapshot',
  IncidentReport: 'IncidentReport',
  BoQ: 'BoQ',
  BoQLine: 'BoQLine',
  MaterialPriceIndex: 'MaterialPriceIndex',
  SubcontractorScore: 'SubcontractorScore',
  CostOverrunSignal: 'CostOverrunSignal',
  WorkflowTemplate: 'WorkflowTemplate',
  RecurringTask: 'RecurringTask',
  ChatChannel: 'ChatChannel',
  ChatMessage: 'ChatMessage',
  SlaBreach: 'SlaBreach',
  Agent: 'Agent',
  AgentRun: 'AgentRun',
  AgentMemory: 'AgentMemory',
  ModelCard: 'ModelCard',
  AiCitation: 'AiCitation',
  ExplanationRequest: 'ExplanationRequest',
  DriftSnapshot: 'DriftSnapshot',
  DataLineage: 'DataLineage',
  BiasAudit: 'BiasAudit',
  AiCostEvent: 'AiCostEvent',
  ZaloIdentity: 'ZaloIdentity',
  OutboundMessage: 'OutboundMessage',
  EInvoice: 'EInvoice',
  FengShuiAnalysis: 'FengShuiAnalysis',
  IdCardScan: 'IdCardScan',
  LunarEvent: 'LunarEvent',
  ApiKey: 'ApiKey',
  Webhook: 'Webhook',
  WebhookDelivery: 'WebhookDelivery',
  Connector: 'Connector',
  DevicePushToken: 'DevicePushToken',
  OfflineSyncOp: 'OfflineSyncOp',
  Plan: 'Plan',
  Subscription: 'Subscription',
  NpsResponse: 'NpsResponse',
  Referral: 'Referral',
  TemplateListing: 'TemplateListing'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
