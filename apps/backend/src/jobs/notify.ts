//=============================================================================
// notify.ts — Gửi cảnh báo về Telegram cho tổ trực (PRD §15).
// Anti-spam: cooldown theo key (mặc định 5 phút/source) — sự cố kéo dài không
// bắn mỗi giây. Chưa cấu hình token/chat → log console (dev), không crash.
//=============================================================================
import { logger } from '../core/logger.js';

export type NotifyResult = 'sent' | 'skipped-cooldown' | 'logged' | 'error';

export interface NotifierOptions {
  botToken?: string;
  chatId?: string;
  /** Ms giữa 2 tin cùng key (mặc định 5 phút). */
  cooldownMs?: number;
  /** Timeout gọi Telegram API (mặc định 10s — chống treo request). */
  timeoutMs?: number;
  /** Inject fetch mock cho test. */
  fetchFn?: typeof fetch;
}

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

export class TelegramNotifier {
  private readonly lastSent = new Map<string, number>();
  private readonly cooldownMs: number;
  private readonly timeoutMs: number;
  private readonly botToken: string;
  private readonly chatId: string;
  private readonly fetchFn: typeof fetch;

  constructor(opts: NotifierOptions = {}) {
    this.botToken = opts.botToken ?? process.env['VTC_TELEGRAM_BOT_TOKEN'] ?? '';
    this.chatId = opts.chatId ?? process.env['VTC_TELEGRAM_CHAT_ID'] ?? '';
    this.cooldownMs = opts.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  get configured(): boolean {
    return this.botToken !== '' && this.chatId !== '';
  }

  /**
   * Gửi tin. Cùng key trong cooldown → bỏ qua (trả skipped-cooldown).
   * Template chuẩn để filter: [CẢNH BÁO][<SOURCE>][<LEVEL>] <msg>
   */
  async alert(key: string, text: string, now = Date.now()): Promise<NotifyResult> {
    const last = this.lastSent.get(key) ?? -Infinity;
    if (now - last < this.cooldownMs) return 'skipped-cooldown';

    if (!this.configured) {
      logger.info(`[notify][${key}] ${text}`);
      this.lastSent.set(key, now);
      return 'logged';
    }
    try {
      // Timeout: mạng ra Telegram chập chờn không được treo request API.
      const r = await this.fetchFn(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: this.chatId, text }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!r.ok) return 'error';
      this.lastSent.set(key, now);
      return 'sent';
    } catch {
      return 'error';
    }
  }
}

/** Ghép tin chuẩn cho sự cố process (Trigger 1, PRD §15). */
export function processAlertText(sourceId: string, detail: string, action = 'Đang tiến hành Auto-restart...'): string {
  const t = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  return `🚨 [CẢNH BÁO][${sourceId}] ${detail} lúc ${t}. ${action}`;
}
