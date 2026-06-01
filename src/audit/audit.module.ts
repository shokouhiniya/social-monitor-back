import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';

/**
 * AuditModule — ثبت ممیزی سبک اقدام‌های حساس (design §5.12 / §6.9،
 * Requirement 11.5).
 *
 * موجودیت جدید `AuditLog` روی جدول جدید `audit_logs` نگاشت می‌شود (ساخته‌شده در
 * مهاجرت `Phase3AuthAudit1739200000000`). `AuditService` صادر می‌شود تا
 * ماژول‌های دامنه (Sources، Jobs، Prompts، Settings، Operations) بتوانند
 * اقدام‌های حساس را به‌صورت افزایشی ثبت کنند.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
