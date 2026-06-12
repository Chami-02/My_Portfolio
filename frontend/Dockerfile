# Use the official Node 24 slim image
FROM node:24-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the package recipe files first
COPY package*.json ./

# Install the dependencies inside the container
RUN npm install

# Copy the rest of your React files
COPY . .

# Expose the Vite port
EXPOSE 5173

# Start the development server
CMD ["npm", "run", "dev"]