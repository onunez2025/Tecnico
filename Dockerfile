FROM node:20-slim

WORKDIR /app

# Instalar dependencias necesarias para mssql y bcrypt en slim si fuera necesario
# RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Construir el frontend
RUN npm run build

# Instalar tsx para ejecutar el servidor
RUN npm install -g tsx

EXPOSE 3000

CMD ["tsx", "server.ts"]
