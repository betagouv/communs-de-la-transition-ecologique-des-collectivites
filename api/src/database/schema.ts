import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: timestamp("createdAt").defaultNow(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  ownerUserId: text("ownerUserId").notNull(),
});
