import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for React frontend
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });
  
  await app.listen(PORT);
  console.log(`[NestJS] Server running on http://localhost:${PORT}`);
}
bootstrap();
