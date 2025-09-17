FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy source code
COPY . .

# Create proxy list if it doesn't exist
RUN touch /app/proxy-list.txt

EXPOSE 8080

CMD ["node", "index.js"]
