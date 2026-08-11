-- CreateEnum
CREATE TYPE "ProjectDepartment" AS ENUM ('CONG_VIEC', 'DAU_THAU', 'HANH_CHINH', 'TAI_CHINH_KE_TOAN', 'PHAT_TRIEN_THI_TRUONG', 'CONG_VIEC_KHAC');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "department" "ProjectDepartment" NOT NULL DEFAULT 'CONG_VIEC_KHAC';
