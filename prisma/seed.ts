import { PrismaClient } from '@prisma/client'
import bcryptjs from 'bcryptjs'

const prisma = new PrismaClient()

function uuid() {
  return crypto.randomUUID()
}

async function main() {
  console.log('🗑️  Clearing existing data...')

  await prisma.checklistEntry.deleteMany()
  await prisma.checklistSubmission.deleteMany()
  await prisma.checklistItem.deleteMany()
  await prisma.checklistTemplate.deleteMany()
  await prisma.hourlyReport.deleteMany()
  await prisma.photo.deleteMany()
  await prisma.faultReport.deleteMany()
  await prisma.task.deleteMany()
  await prisma.workerAssetAssignment.deleteMany()
  await prisma.asset.deleteMany()
  await prisma.assetCategory.deleteMany()
  await prisma.user.deleteMany()
  await prisma.tenant.deleteMany()

  // --- Tenant ---
  console.log('🏭 Creating tenant...')
  const tenant = await prisma.tenant.create({
    data: { id: uuid(), name: 'Agcan Tesisi', slug: 'agcan' },
  })
  const t = tenant.id

  // --- Asset Categories ---
  console.log('📂 Creating asset categories...')
  const catU1 = await prisma.assetCategory.create({
    data: { id: uuid(), tenantId: t, name: 'Kırma/Eleme', code: 'U1', displayOrder: 1 },
  })
  const catU2 = await prisma.assetCategory.create({
    data: { id: uuid(), tenantId: t, name: 'İkincil Kırma', code: 'U2', displayOrder: 2 },
  })
  const catU3 = await prisma.assetCategory.create({
    data: { id: uuid(), tenantId: t, name: 'Değirmen', code: 'U3', displayOrder: 3 },
  })
  const catTV = await prisma.assetCategory.create({
    data: { id: uuid(), tenantId: t, name: 'Taşıt', code: 'TV', displayOrder: 4 },
  })
  const catIM = await prisma.assetCategory.create({
    data: { id: uuid(), tenantId: t, name: 'İş Makinası', code: 'IM', displayOrder: 5 },
  })

  // --- Assets (Machines) ---
  console.log('⚙️  Creating 40 machines...')

  const meta = (obj: Record<string, string>) => JSON.stringify(obj)

  // U1 – Kırma/Eleme (18 machines)
  const u1Machines = [
    { code: 'U1-EL11', name: 'Elek 11 - 2000x6000', metadata: meta({ type: 'Elek', detail: 'Konkasör eleği' }) },
    { code: 'U1-KR11', name: 'Kırıcı 11 - Primer Çeneli', metadata: meta({ type: 'Kırıcı', detail: 'Rus 100 Çeneli Kırıcı' }) },
    { code: 'U1-KR12', name: 'Kırıcı 12 - Sekonder Konik', metadata: meta({ type: 'Kırıcı', detail: 'K950 Gürsan Konik' }) },
    { code: 'U1-EL12', name: 'Elek 12 - Susuzlandırma', metadata: meta({ type: 'Elek' }) },
    { code: 'U1-BN11', name: 'Bunker 11 - 25m3', metadata: meta({ type: 'Bunker' }) },
    { code: 'U1-BN12', name: 'Bunker 12 - 10m3', metadata: meta({ type: 'Bunker' }) },
    { code: 'U1-BS11', name: 'Besleyici 11 - Vargel', metadata: meta({ type: 'Besleyici' }) },
    { code: 'U1-BT12', name: 'Bant 12 - Ana Bant', metadata: meta({ type: 'Konveyör Bant', detail: 'Çeneden eleğe, 62m, 800mm' }) },
    { code: 'U1-BT13', name: 'Bant 13 - Elek>Bunker', metadata: meta({ type: 'Konveyör Bant' }) },
    { code: 'U1-BT14', name: 'Bant 14 - Bunker>Konik', metadata: meta({ type: 'Konveyör Bant' }) },
    { code: 'U1-BT11', name: 'Bant 11 - Besleyici altı', metadata: meta({ type: 'Konveyör Bant' }) },
    { code: 'U1-BT15', name: 'Bant 15 - Konik>Elek', metadata: meta({ type: 'Konveyör Bant' }) },
    { code: 'U1-BT16', name: 'Bant 16 - Susuzlandırma>Kum', metadata: meta({ type: 'Konveyör Bant', detail: 'Kum Bantı' }) },
    { code: 'U1-BT17', name: 'Bant 17 - Değirmen Bunkere', metadata: meta({ type: 'Konveyör Bant' }) },
    { code: 'U1-PN11', name: 'Pano 11', metadata: meta({ type: 'Elektrik', detail: 'Konkasör kumanda panosu' }) },
    { code: 'U1-PM11', name: 'Pompa 11 - Çamur 4x3', metadata: meta({ type: 'Pompa' }) },
    { code: 'U1-PM12', name: 'Pompa 12 - Dalgıç Çamur', metadata: meta({ type: 'Pompa' }) },
    { code: 'U1-PM13', name: 'Pompa 13 - Su Pompası', metadata: meta({ type: 'Pompa' }) },
  ]

  // U2 – İkincil Kırma (10 machines)
  const u2Machines = [
    { code: 'U2-KR21', name: 'Kırıcı 21 - Dik Milli VSI', metadata: meta({ type: 'Kırıcı', detail: 'VSI 900 Aymak' }) },
    { code: 'U2-EL21', name: 'Elek 21 - 1600x5000', metadata: meta({ type: 'Elek', detail: '3 katlı' }) },
    { code: 'U2-BT21', name: 'Bant 21 - Ana Bant', metadata: meta({ type: 'Konveyör Bant' }) },
    { code: 'U2-BT22', name: 'Bant 22 - Dik Milli>Elek', metadata: meta({ type: 'Konveyör Bant' }) },
    { code: 'U2-BT23', name: 'Bant 23 - Geri Dönüş', metadata: meta({ type: 'Konveyör Bant' }) },
    { code: 'U2-BT24', name: 'Bant 24 - Kum Çıkışı', metadata: meta({ type: 'Konveyör Bant' }) },
    { code: 'U2-BT25', name: 'Bant 25 - Çakıl Çıkışı', metadata: meta({ type: 'Konveyör Bant', detail: '80cm' }) },
    { code: 'U2-BN21', name: 'Bunker 21 - 20m3', metadata: meta({ type: 'Bunker' }) },
    { code: 'U2-BS21', name: 'Besleyici 21 - Titreşimli', metadata: meta({ type: 'Besleyici' }) },
    { code: 'U2-PN21', name: 'Pano 21', metadata: meta({ type: 'Elektrik', detail: 'Kumanda odası' }) },
  ]

  // U3 – Değirmen (12 machines)
  const u3Machines = [
    { code: 'U3-KR31', name: 'Kırıcı 31 - Değirmen 2500x4000', metadata: meta({ type: 'Kırıcı', detail: '250kw' }) },
    { code: 'U3-BN31', name: 'Bunker 31 - 40m3', metadata: meta({ type: 'Bunker', detail: 'Büyük bunker' }) },
    { code: 'U3-BN32', name: 'Bunker 32 - 20m3', metadata: meta({ type: 'Bunker', detail: 'Yol tarafı' }) },
    { code: 'U3-BT31', name: 'Bant 31 - B.Bunker>Değirmen', metadata: meta({ type: 'Konveyör Bant', detail: '80cm' }) },
    { code: 'U3-BT32', name: 'Bant 32 - K.Bunker>Değirmen', metadata: meta({ type: 'Konveyör Bant', detail: '65cm' }) },
    { code: 'U3-BT33', name: 'Bant 33 - Elek>Kum Çıkışı', metadata: meta({ type: 'Konveyör Bant' }) },
    { code: 'U3-BT34', name: 'Bant 34 - Geri Dönüş', metadata: meta({ type: 'Konveyör Bant', detail: '65cm' }) },
    { code: 'U3-BN33', name: 'Bunker 33 - 20m3', metadata: meta({ type: 'Bunker', detail: 'Taştozu' }) },
    { code: 'U3-EL31', name: 'Elek 31 - 1500x4000', metadata: meta({ type: 'Elek', detail: '2 katlı' }) },
    { code: 'U3-EL32', name: 'Elek 32 - Susuzlandırma', metadata: meta({ type: 'Elek' }) },
    { code: 'U3-PN31', name: 'Pano 31', metadata: meta({ type: 'Elektrik', detail: 'Kumanda panosu' }) },
    { code: 'U3-PM31', name: 'Pompa 31 - Çamur 8x10', metadata: meta({ type: 'Pompa', detail: 'Svedala Vasa' }) },
  ]

  // TV – Taşıt
  const tvAssets = [
    { code: 'TV-53EB648-3229', name: '53EB648 - 3229', metadata: meta({ type: 'Taşıt' }) },
    { code: 'TV-53AAE606-4142', name: '53AAE606 - 4142', metadata: meta({ type: 'Taşıt' }) },
    { code: 'TV-53AJ606-935', name: '53AJ606 - 935', metadata: meta({ type: 'Taşıt' }) },
    { code: 'TV-53ABM606-827', name: '53ABM606 - 827', metadata: meta({ type: 'Taşıt' }) },
    { code: 'TV-53AAC606-FMAX', name: '53AAC606 - FMax', metadata: meta({ type: 'Taşıt' }) },
    { code: 'TV-53ABC606-TRANSIT', name: '53ABC606 - Transit', metadata: meta({ type: 'Taşıt' }) },
  ]

  // IM – İş Makinası
  const imAssets = [
    { code: 'IM-VOLVO-L110', name: 'Volvo L110', metadata: meta({ type: 'İş Makinası' }) },
    { code: 'IM-CAT-966FII', name: 'Cat 966FII', metadata: meta({ type: 'İş Makinası' }) },
    { code: 'IM-HYUNDAI-LC7-210', name: 'Hyundai LC7-210', metadata: meta({ type: 'İş Makinası' }) },
  ]

  const createAssets = (machines: typeof u1Machines, categoryId: string) =>
    Promise.all(
      machines.map((m) =>
        prisma.asset.create({
          data: { id: uuid(), tenantId: t, categoryId, ...m },
        }),
      ),
    )

  await createAssets(u1Machines, catU1.id)
  await createAssets(u2Machines, catU2.id)
  await createAssets(u3Machines, catU3.id)
  await createAssets(tvAssets, catTV.id)
  await createAssets(imAssets, catIM.id)

  console.log(`   Created ${u1Machines.length + u2Machines.length + u3Machines.length + tvAssets.length + imAssets.length} machines`)

  // --- Users ---
  console.log('👤 Creating users...')
  const pw = bcryptjs.hashSync('1234', 10)

  await prisma.user.create({
    data: { id: uuid(), tenantId: t, username: 'admin', fullName: 'Yönetici', passwordHash: pw, role: 'admin' },
  })
  await prisma.user.create({
    data: { id: uuid(), tenantId: t, username: 'ustabasi', fullName: 'Ustabaşı Ahmet', passwordHash: pw, role: 'foreman' },
  })
  await prisma.user.create({
    data: {
      id: uuid(),
      tenantId: t,
      username: 'isci1',
      fullName: 'Ali Demir',
      passwordHash: pw,
      role: 'worker',
      jobTitle: 'Operatör',
    },
  })

  // --- Checklist Templates ---
  console.log('📋 Creating checklist templates...')

  // 1) U1 Günlük Kontrol
  const tpl1 = await prisma.checklistTemplate.create({
    data: { id: uuid(), tenantId: t, categoryId: catU1.id, name: 'U1 Günlük Kontrol' },
  })
  const tpl1Assets = await prisma.asset.findMany({
    where: { tenantId: t, categoryId: catU1.id, isDeleted: false },
    select: { id: true },
    orderBy: { name: 'asc' },
  })
  await prisma.checklistTemplateAsset.createMany({
    data: tpl1Assets.map((a, idx) => ({
      id: uuid(),
      tenantId: t,
      templateId: tpl1.id,
      assetId: a.id,
      sortOrder: idx,
      isActive: true,
    })),
  })
  await prisma.checklistItem.createMany({
    data: tpl1Assets.flatMap((a) => ([
      { id: uuid(), templateId: tpl1.id, assetId: a.id, label: 'Primer kırıcı yağ seviyesi kontrol', itemType: 'tick', displayOrder: 1 },
      { id: uuid(), templateId: tpl1.id, assetId: a.id, label: 'Konveyör bantlar gözle kontrol', itemType: 'tick', displayOrder: 2 },
      {
        id: uuid(), templateId: tpl1.id, assetId: a.id, label: 'Elek gerginlik kontrolü', itemType: 'two_option',
        options: JSON.stringify(['Normal', 'Anormal']), displayOrder: 3,
      },
    ])),
  })

  // 2) U2 Günlük Kontrol
  const tpl2 = await prisma.checklistTemplate.create({
    data: { id: uuid(), tenantId: t, categoryId: catU2.id, name: 'U2 Günlük Kontrol' },
  })
  const tpl2Assets = await prisma.asset.findMany({
    where: { tenantId: t, categoryId: catU2.id, isDeleted: false },
    select: { id: true },
    orderBy: { name: 'asc' },
  })
  await prisma.checklistTemplateAsset.createMany({
    data: tpl2Assets.map((a, idx) => ({
      id: uuid(),
      tenantId: t,
      templateId: tpl2.id,
      assetId: a.id,
      sortOrder: idx,
      isActive: true,
    })),
  })
  await prisma.checklistItem.createMany({
    data: tpl2Assets.flatMap((a) => ([
      { id: uuid(), templateId: tpl2.id, assetId: a.id, label: 'VSI Kırıcı yağlama kontrolü', itemType: 'tick', displayOrder: 1 },
      {
        id: uuid(), templateId: tpl2.id, assetId: a.id, label: 'Besleyici titreşim normal mi?', itemType: 'two_option',
        options: JSON.stringify(['Normal', 'Anormal']), displayOrder: 2,
      },
    ])),
  })

  // 3) U3 Günlük Kontrol
  const tpl3 = await prisma.checklistTemplate.create({
    data: { id: uuid(), tenantId: t, categoryId: catU3.id, name: 'U3 Günlük Kontrol' },
  })
  const tpl3Assets = await prisma.asset.findMany({
    where: { tenantId: t, categoryId: catU3.id, isDeleted: false },
    select: { id: true },
    orderBy: { name: 'asc' },
  })
  await prisma.checklistTemplateAsset.createMany({
    data: tpl3Assets.map((a, idx) => ({
      id: uuid(),
      tenantId: t,
      templateId: tpl3.id,
      assetId: a.id,
      sortOrder: idx,
      isActive: true,
    })),
  })
  await prisma.checklistItem.createMany({
    data: tpl3Assets.flatMap((a) => ([
      { id: uuid(), templateId: tpl3.id, assetId: a.id, label: 'Değirmen yağ seviyesi', itemType: 'numeric', unit: 'litre', displayOrder: 1 },
      { id: uuid(), templateId: tpl3.id, assetId: a.id, label: 'Pompa 31 basınç kontrolü', itemType: 'numeric', unit: 'bar', displayOrder: 2 },
    ])),
  })

  console.log('✅ Seed completed successfully!')
  console.log(`   Tenant: ${tenant.name}`)
  console.log(`   Categories: 5`)
  console.log(`   Machines: 49`)
  console.log(`   Users: 3 (admin / ustabasi / isci1 — password: 1234)`)
  console.log(`   Checklist templates: 3`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
