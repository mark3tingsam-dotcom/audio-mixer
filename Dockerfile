FROM node:18-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY server.js ./
ENV PORT=8080
EXPOSE 8080
CMD ["node","server.js"]
