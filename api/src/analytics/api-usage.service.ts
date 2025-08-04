import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@/database/database.service";
import { apiRequests, projets, serviceContext } from "@/database/schema";
import { and, count, gte, lte } from "drizzle-orm";
import { GetGlobalStatsQuery, GlobalStatsResponse } from "@/analytics/analytics.dto";

@Injectable()
export class ApiUsageService {
  constructor(private db: DatabaseService) {}

  async getGlobalStats({ startDate, endDate }: GetGlobalStatsQuery): Promise<GlobalStatsResponse> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const startDateFormatted = startDate ? new Date(startDate) : sixMonthsAgo;
    const endDateFormatted = endDate ? new Date(endDate) : new Date();

    const conditions = [gte(apiRequests.createdAt, startDateFormatted), lte(apiRequests.createdAt, endDateFormatted)];
    const [result] = await this.db.database
      .select({ apiCallsCount: count() })
      .from(apiRequests)
      .where(and(...conditions));

    const [totalProjects] = await this.db.database.select({ projetsCount: count() }).from(projets);

    const [totalServiceContext] = await this.db.database.select({ servicesCount: count() }).from(serviceContext);

    return { ...totalProjects, ...result, ...totalServiceContext };
  }

  async recordRequest(data: {
    method: string;
    endpoint: string;
    fullUrl: string;
    statusCode: number;
    responseTimeInMs: number;
    serviceName: string | undefined;
  }) {
    await this.db.database.insert(apiRequests).values(data);
  }
}
