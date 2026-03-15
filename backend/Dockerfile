# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Using tsx/typescript to compile or run - for production we'll use tsx for simplicity with your current setup
# but normally we'd compile to JS. Let's keep it consistent with your tsx setup.

# Stage 2: Run
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app ./
RUN npm install --production
# Ensure service-account.json will be provided via volume or manual copy
EXPOSE 3000
CMD ["npm", "start"]
