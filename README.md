# Sistem Raport Sekolah - Multi-Jenjang (SD, SMP, SMA, Aliyah)

Sistem manajemen raport berbasis web yang komprehensif untuk mengakomodasi kebutuhan sekolah dari jenjang SD hingga Aliyah. Dibangun dengan teknologi modern: **Next.js 15**, **TypeScript**, **Bun**, **Prisma**, dan **PostgreSQL**.

## 🎯 Fitur Utama

- ✅ **Multi-Jenjang**: Mendukung SD, SMP, SMA, dan Aliyah dengan konfigurasi berbeda
- ✅ **Autentikasi Aman**: JWT dengan access token + refresh token (HttpOnly cookie)
- ✅ **Manajemen Data**:
  - Sekolah, tahun ajaran, semester, kelas
  - Guru, siswa, mata pelajaran
  - Kompetensi (pengetahuan, keterampilan, sikap)
  - Nilai dan kehadiran siswa
- ✅ **Role-Based Access Control**: Admin, Guru, Kepala Sekolah
- ✅ **Input Nilai Fleksibel**: Mendukung berbagai sistem penilaian (1-4, 0-100, A-D, E-A)
- ✅ **Laporan & Analytics**: Dashboard dengan statistik
- ✅ **API RESTful**: Endpoint lengkap untuk integrasi

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Bun |
| **Frontend** | Next.js 15 + React 19 + TypeScript |
| **Styling** | Tailwind CSS |
| **Database** | PostgreSQL + Prisma ORM |
| **Auth** | JWT (jsonwebtoken) + bcryptjs |
| **Validation** | Zod |
| **Package Manager** | Bun |

## 📋 Prerequisites

- Node.js 18+ atau Bun 1.0+
- PostgreSQL 12+
- Git

## 🚀 Setup & Installation

### 1. Clone & Install Dependencies

```bash
cd /home/aran/raport
bun install
```

### 2. Setup Database

#### Option A: PostgreSQL Local (Recommended)

```bash
# Install PostgreSQL (jika belum ada)
# Ubuntu/Debian:
sudo apt-get install postgresql postgresql-contrib

# macOS (using Homebrew):
brew install postgresql

# Start PostgreSQL service
sudo systemctl start postgresql  # Linux
brew services start postgresql  # macOS
```

#### Option B: Using Docker

```bash
docker run --name raport-postgres \
  -e POSTGRES_USER=raport_user \
  -e POSTGRES_PASSWORD=raport_password \
  -e POSTGRES_DB=raport_db \
  -p 5432:5432 \
  -d postgres:15
```

### 3. Setup Environment Variables

```bash
# Copy .env.example ke .env.local
cp .env.example .env.local

# Edit .env.local dengan konfigurasi database Anda
# DATABASE_URL="postgresql://raport_user:raport_password@localhost:5432/raport_db"
```

### 4. Run Prisma Migration

```bash
# Generate Prisma Client
bun run prisma:generate

# Run migrations untuk membuat schema database
bun run prisma:migrate

# Atau langsung push schema (untuk development):
bunx prisma db push
```

### 5. Seed Database (Opsional - untuk test data)

```bash
# Buat data dummy untuk testing
bun run seed
```

### 6. Start Development Server

```bash
bun run dev
```

Server akan berjalan di `http://localhost:3000`

## 📝 Test Credentials (Setelah Seed)

```
Admin:
  Email: admin@sekolah.id
  Password: password123

Teacher 1:
  Email: guru1@sekolah.id
  Password: password123

Teacher 2:
  Email: guru2@sekolah.id
  Password: password123
```

## 📁 Project Structure

```
raport/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes
│   │   ├── auth/            # Authentication endpoints
│   │   ├── admin/           # Admin endpoints
│   │   └── teacher/         # Teacher endpoints
│   ├── admin/               # Admin pages
│   ├── teacher/             # Teacher pages
│   └── login/               # Login page
├── lib/                     # Shared utilities
│   ├── auth/               # JWT & password utilities
│   └── api-response.ts     # API response helpers
├── prisma/                 # Database schema
│   └── schema.prisma       # Prisma schema definition
├── scripts/                # Scripts
│   └── seed.ts             # Database seeding
├── middleware.ts           # Auth middleware
├── package.json            # Dependencies & scripts
└── tsconfig.json           # TypeScript config
```

## 🔐 Authentication Flow

### Login Flow
1. User mengirim email + password ke `/api/auth/login`
2. Server memvalidasi credentials
3. Server generate **access token** (15 menit) + **refresh token** (7 hari)
4. Access token dikembalikan ke client (disimpan di localStorage)
5. Refresh token disimpan di HttpOnly secure cookie

### Token Refresh Flow
1. Sebelum access token expired, client call `/api/auth/refresh`
2. Server verify refresh token dari cookie
3. Server generate access token baru
4. Client update localStorage dengan token baru

### Logout Flow
1. Client call `/api/auth/logout` dengan access token
2. Server delete refresh token dari database
3. Server clear refresh token cookie

## 🗄️ Database Schema

### Core Models
- **User**: Admin, Guru, Kepala Sekolah
- **RefreshToken**: Token refresh untuk authentication
- **School**: Data sekolah
- **Level**: Jenjang pendidikan (SD, SMP, SMA, Aliyah)
- **SchoolYear**: Tahun ajaran (2024/2025)
- **Semester**: Semester 1 & 2
- **Class**: Kelas (e.g., 12 IPA 1)
- **Student**: Siswa
- **Subject**: Mata pelajaran
- **Competency**: Kompetensi pembelajaran
- **Grade**: Nilai siswa per kompetensi
- **Attendance**: Kehadiran siswa
- **ReportConfig**: Konfigurasi penilaian per jenjang

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login dengan email & password |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout (revoke token) |

### Teacher Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teacher/students?classId=...` | List siswa |
| POST | `/api/teacher/students` | Buat siswa baru |
| GET | `/api/teacher/students/[id]` | Detail siswa |
| PUT | `/api/teacher/students/[id]` | Update siswa |
| DELETE | `/api/teacher/students/[id]` | Delete siswa |
| GET | `/api/teacher/grades?studentId=...` | List nilai |
| POST | `/api/teacher/grades` | Input nilai |

### Response Format
```json
{
  "success": true,
  "data": { ... }
}
```

Error:
```json
{
  "success": false,
  "error": "Error message",
  "details": { ... }
}
```

## 📝 Script Commands

```bash
# Development
bun run dev              # Start dev server
bun run build            # Build for production
bun run start            # Start production server

# Database
bun run prisma:generate  # Generate Prisma Client
bun run prisma:migrate   # Run migrations
bun run prisma:studio    # Open Prisma Studio GUI
bun run seed             # Seed database dengan test data

# Linting
bun run lint             # Run ESLint
```

## 🐛 Troubleshooting

### Error: `ECONNREFUSED` saat koneksi database
- Pastikan PostgreSQL sudah running
- Cek DATABASE_URL di .env.local
- Test connection: `psql postgresql://user:password@localhost:5432/raport_db`

### Error: "Prisma engines not available"
- Hapus node_modules dan bun.lockb
- Jalankan `bun install` lagi
- Jalankan `bun run prisma:generate`

### Error: "Token expired" saat akses protected route
- Refresh token via `/api/auth/refresh`
- Client akan mendapat access token baru
- Retry request dengan token baru

## 🎨 Features Coming Soon

- [ ] Admin API untuk CRUD sekolah, tahun ajaran, semester, kelas
- [ ] Sistem penilaian dinamis berdasarkan jenjang
- [ ] Generate raport PDF per siswa
- [ ] Dashboard analytics & reporting
- [ ] Sistem notifikasi untuk guru & orang tua
- [ ] Mobile app (React Native)
- [ ] Export nilai ke Excel
- [ ] Absensi online
- [ ] Email verification & reset password
- [ ] Two-factor authentication
- [ ] Audit logs

## 📄 License

MIT License - Bebas digunakan untuk tujuan komersial maupun non-komersial.

---

**Built with ❤️ using Next.js, Prisma & Bun**

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
