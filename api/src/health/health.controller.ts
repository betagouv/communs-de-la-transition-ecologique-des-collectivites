import { Controller, Get, Res } from "@nestjs/common";
import { Response } from "express";
import { Public } from "@/auth/public.decorator";
import { DatabaseService } from "@database/database.service";
import { sql } from "drizzle-orm";

@Controller("health")
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  @Public()
  async check(@Res() res: Response) {
    try {
      await this.databaseService.database.execute(sql`SELECT 1`);
      res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(503).json({
        status: "error",
        error: error instanceof Error ? error.message : "Database unreachable",
      });
    }
  }
}
