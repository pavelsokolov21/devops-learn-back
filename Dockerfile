# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app

# Для кеша: сначала только манифесты
COPY package.json package-lock.json ./
RUN npm ci --omit=dev


# ---------- runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# (опционально) создать непривилегированного пользователя
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

# Скопировать node_modules из deps
COPY --from=deps /app/node_modules ./node_modules

# Скопировать исходники
COPY . .

# Важно: Express должен слушать 0.0.0.0, а не localhost
# Например: app.listen(process.env.PORT || 3000, "0.0.0.0")
EXPOSE 3000

USER nodeuser

CMD ["npm", "run", "serve"]
