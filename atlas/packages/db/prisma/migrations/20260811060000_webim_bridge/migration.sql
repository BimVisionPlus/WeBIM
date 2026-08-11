-- WeBIM bridge: an ApiKey now records who issued it, so writes made with the
-- key (WeBIM → Models) carry a real actorId on their audit rows.
ALTER TABLE "ApiKey" ADD COLUMN "createdByUserId" TEXT;
