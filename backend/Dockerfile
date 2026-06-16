FROM node:24-slim

WORKDIR /app

# Copy package files first — lets Docker cache the npm install layer
COPY package*.json ./

RUN npm install

# Copy the rest of the source code
COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]
