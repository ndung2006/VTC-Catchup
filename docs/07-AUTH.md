# B6 — Auth: bcrypt + JWT HttpOnly + gate API (PRD §4.8)

> `tsc` sạch, `npm test` **21/21 xanh** (8 cũ + 9 API-gồm-auth + 4 auth đơn vị).

## Thiết kế (khớp PRD từng điểm)

| PRD yêu cầu | Làm ở đâu |
|---|---|
| bcrypt salt 10, không plaintext | `auth.ts: hashPassword/checkPassword`, `SALT_ROUNDS=10` |
| JWT 7 ngày trong HttpOnly Cookie (không localStorage) | `signToken/verifyToken`, `jwtSetCookie` (`HttpOnly; Path=/; SameSite=Lax`, `Secure` khi `VTC_COOKIE_SECURE=1`) |
| Đổi MK: 3 trường, min 8, confirm khớp, compare cũ | `POST /api/auth/change-password` |
| Quên MK: message chung (chống enumerate), reset token 15' | `POST /api/auth/forgot-password` → `FORGOT_MSG` cố định; token `randomBytes(32)` + `RESET_TTL_MS` |
| Đặt lại qua link | `POST /api/auth/reset-password {token, newPassword}` |
| Frontend middleware redirect /login | Phase 4 (`middleware.ts` đọc cookie `vtc_token`) |
| Backend `verifyAuth` chặn trước mọi API nghiệp vụ | `makeRequireAuth()` gate mọi `/api/*` trừ `/api/auth/*` và `/health` → 401 trước khi spawn/chạm đĩa |

## Env

- `VTC_JWT_SECRET` — bắt buộc ở Prod (dev warn + dùng default).
- `VTC_ADMIN_USER / VTC_ADMIN_EMAIL / VTC_ADMIN_PASS` — seed admin lúc boot (mặc định `admin / admin@vtc.local / admin12345`, warn khi dùng default).
- `VTC_COOKIE_SECURE=1` — bật flag Secure khi chạy HTTPS Prod.
- SMTP/Nodemailer gửi mail thật: Phase sau (hiện log reset link ra console để dev/test).

## Thử nhanh

```sh
cd apps/backend && npm install && npm run dev
curl -c jar.txt -X POST localhost:8080/api/auth/login -H 'content-type: application/json' \
  -d '{"username":"admin","password":"admin12345"}'
curl -b jar.txt localhost:8080/api/sources
curl -b jar.txt -X POST localhost:8080/api/auth/change-password -H 'content-type: application/json' \
  -d '{"currentPassword":"admin12345","newPassword":"doi-moi-123","confirmPassword":"doi-moi-123"}'
curl localhost:8080/api/sources   # → 401 unauthorized (không cookie)
```

## Lưu ý bảo mật đã áp dụng

- Login sai/user lạ cùng message `sai tên đăng nhập hoặc mật khẩu` (không lộ user nào tồn tại).
- `bcrypt.compare` chạy cả khi user không tồn tại? Hiện return sớm — chấp nhận được cho nội bộ; nếu cần chống timing-attack thì compare với hash giả (ghi chú cho bản cứng hơn).
- Reset token vô hiệu ngay sau khi dùng (`setPasswordHash` xóa token).
