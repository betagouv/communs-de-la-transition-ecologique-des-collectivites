import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@/database/database.service";
import { apiRequests } from "@/database/schema";
import { and, gte, lte, sql } from "drizzle-orm";
import { GetGlobalStatsQuery } from "@/analytics/analytics.dto";

@Injectable()
export class ApiUsageService {
  constructor(private db: DatabaseService) {}

  async getGlobalStats(filter: GetGlobalStatsQuery) {
    const { startDate, endDate } = filter;

    const startDateFormatted = new Date(startDate);
    const endDateFormatted = new Date(endDate);

    const conditions = [];

    if (startDate) {
      conditions.push(gte(apiRequests.createdAt, startDateFormatted));
    }
    if (endDate) {
      conditions.push(lte(apiRequests.createdAt, endDateFormatted));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const [result] = await this.db.database
      .select({
        totalRequests: sql<number>`COUNT(*)::int`,
        avgResponseTime: sql<number>`ROUND(AVG(${apiRequests.responseTimeInMs})::numeric, 2)::float`,
        successRate: sql<number>`ROUND((COUNT(CASE WHEN ${apiRequests.statusCode} < 400 THEN 1 END) * 100.0 / COUNT(*))::numeric, 2)::float`,
        uniqueEndpoints: sql<number>`COUNT(DISTINCT ${apiRequests.endpoint})::int`,
        uniqueApiKeys: sql<number>`COUNT(DISTINCT ${apiRequests.serviceName})::int`,
      })
      .from(apiRequests)
      .where(whereCondition);

    return result;
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
