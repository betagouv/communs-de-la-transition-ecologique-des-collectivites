// Doit être importé EN PREMIER par e2e-global-setup : les variables d'environnement
// lues à l'import des modules applicatifs (ex. throttler.config.ts) doivent être posées
// avant que la chaîne d'imports d'AppModule ne s'évalue. Un simple `process.env.X = …`
// dans le corps de globalSetup arrive trop tard (hoisting des imports).
process.env.THROTTLER_LIMIT = process.env.THROTTLER_LIMIT ?? "10000";
