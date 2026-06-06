# PropShare Backend API

Platform investasi properti berbasis Web3 — memungkinkan investor membeli token kepemilikan properti kost, menerima dividen otomatis, dan tenant melakukan booking sewa secara digital.

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Salin file .env dan isi variabel
cp .env .env.local

# 3. Generate Prisma Client
npm run db:generate

# 4. Jalankan migrasi database
npm run db:migrate

# 5. Jalankan server (development)
npm run dev
```

---

## 📁 Struktur Folder

```
propshare-backend/
├── prisma/
│   └── schema.prisma          # Skema database
├── src/
│   ├── config/
│   │   └── db.js              # Prisma client singleton
│   ├── controllers/           # Logika bisnis per modul
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── propertyController.js
│   │   ├── investmentController.js
│   │   ├── rentalController.js
│   │   └── dividendController.js
│   ├── middlewares/
│   │   ├── authMiddleware.js  # JWT guard
│   │   └── roleMiddleware.js  # RBAC guard
│   ├── routes/
│   │   ├── index.js           # Router utama
│   │   ├── authRoutes.js
│   │   ├── propertyRoutes.js
│   │   ├── investmentRoutes.js
│   │   ├── rentalRoutes.js
│   │   └── dividendRoutes.js
│   ├── services/
│   │   ├── userService.js     # Prisma queries - User
│   │   └── propertyService.js # Prisma queries - Property
│   ├── utils/
│   │   └── ipfsHelper.js      # Upload file ke Pinata/IPFS
│   └── app.js                 # Entry point Express
├── .env
├── package.json
└── README.md
```

---

## 🔐 Autentikasi

Semua endpoint protected menggunakan JWT Bearer Token.

```
Authorization: Bearer <token>
```

### Roles
| Role       | Akses                                   |
|------------|-----------------------------------------|
| `ADMIN`    | Approve properti, distribusi dividen    |
| `OWNER`    | CRUD properti, verifikasi pembayaran    |
| `INVESTOR` | Investasi, lihat portfolio & dividen    |
| `TENANT`   | Booking kamar, upload bukti bayar       |

---

## 📡 API Endpoints

### Auth & User
| Method | Endpoint                | Deskripsi                    | Akses    |
|--------|-------------------------|------------------------------|----------|
| POST   | `/api/auth/register`    | Registrasi user baru         | Public   |
| POST   | `/api/auth/login`       | Login konvensional (JWT)     | Public   |
| POST   | `/api/auth/web3-login`  | Login via wallet address     | Public   |
| GET    | `/api/auth/users/profile` | Ambil profil user          | All      |
| PUT    | `/api/auth/users/profile` | Update profil & avatar     | All      |

### Properti
| Method | Endpoint                        | Deskripsi                    | Akses    |
|--------|---------------------------------|------------------------------|----------|
| GET    | `/api/properties`               | List semua properti          | Public   |
| GET    | `/api/properties/:id`           | Detail properti              | Public   |
| POST   | `/api/properties`               | Ajukan properti baru         | Owner    |
| GET    | `/api/properties/my-listings`   | Properti milik Owner         | Owner    |
| PATCH  | `/api/properties/:id/status`    | Approve / Reject properti    | Admin    |

### Investasi
| Method | Endpoint                          | Deskripsi                  | Akses    |
|--------|-----------------------------------|----------------------------|----------|
| POST   | `/api/investments`                | Catat investasi baru       | Investor |
| GET    | `/api/investments/my-portfolio`   | Portfolio investor          | Investor |
| GET    | `/api/investments/stats`          | Statistik grafik aset      | Investor |

### Kamar & Sewa
| Method | Endpoint                        | Deskripsi                  | Akses    |
|--------|---------------------------------|----------------------------|----------|
| GET    | `/api/rooms/:propertyId`        | List kamar tersedia        | Public   |
| POST   | `/api/rentals`                  | Booking kamar              | Tenant   |
| GET    | `/api/rentals/my-rentals`       | Riwayat sewa               | Tenant   |
| POST   | `/api/payments`                 | Upload bukti bayar         | Tenant   |

### Dividen
| Method | Endpoint                        | Deskripsi                  | Akses        |
|--------|---------------------------------|----------------------------|--------------|
| PATCH  | `/api/payments/:id/verify`      | Verifikasi pembayaran      | Owner        |
| POST   | `/api/dividends/distribute`     | Distribusi dividen         | Admin        |
| GET    | `/api/dividends/history`        | Riwayat dividen diterima   | Investor     |

---

## 🧪 Contoh Request — Investasi

```json
POST /api/investments
Authorization: Bearer <token>

{
  "propertyId": "uuid-properti-abc",
  "tokenAmount": 50,
  "totalPaid": 500000,
  "txHash": "0xabc123...789"
}
```

**Response 201:**
```json
{
  "status": "success",
  "message": "Investasi berhasil dicatat",
  "data": {
    "investmentId": "uuid-inv-123",
    "confirmedAt": "2026-03-11T20:00:00Z"
  }
}
```

---

## 🌐 Environment Variables

| Key                      | Deskripsi                          |
|--------------------------|------------------------------------|
| `DATABASE_URL`           | PostgreSQL connection string       |
| `JWT_SECRET`             | Secret key untuk signing JWT       |
| `JWT_EXPIRES_IN`         | Durasi token (default: `7d`)       |
| `PORT`                   | Port server (default: `3000`)      |
| `PINATA_API_KEY`         | API Key Pinata untuk IPFS          |
| `PINATA_SECRET_API_KEY`  | Secret Key Pinata                  |
| `PINATA_GATEWAY_URL`     | URL gateway IPFS Pinata            |
