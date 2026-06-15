import { initializeApp } from "firebase/app"
import { getFirestore, collection, getDocs, setDoc, doc, addDoc, query, where, updateDoc } from "firebase/firestore"
import { readFileSync } from "fs"

// Read env vars from .env.local
const envContent = readFileSync(".env.local", "utf-8")
const env = {}
envContent.split("\n").forEach(line => {
  const [key, ...vals] = line.split("=")
  if (key && vals.length) env[key.trim().replace(/['"]/g, "")] = vals.join("=").trim().replace(/['"]/g, "")
})

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const csvData = `Nome;Descrição;Código do serviço;Duração;Categoria;Tipo de Preço;Preço Padrão;Preço Promocional;Custo Médio dos Produtos;Custo Médio dos Produtos para Profissional;Descartáveis e outras despesas;Custo Operacional para Estabelecimento;Custo Operacional para Profissional
1 Progressiva Semi Definitiva Dinheiro;progressiva com duração em média 3 a 4 meses;1;2h e 30 min;Cabelo;Preço Fixo;200;;0;0;0;0;0
2 Progressiva Semi Definitiva Cartão;cartão;2547;2h e 30 min;Cabelo;Preço Fixo;250;;0;0;0;0;0
3 Progressiva Definitiva Dinheiro;o cabelo não enrola mais, com tratamento capilar;2;5h;Cabelo;Preço Fixo;300;;0;0;0;0;0
4 Progressiva Definitiva Cartão;Progressiva DEFINITIVA;2783;3h;Cabelo;Preço Fixo;270;;0;0;20;20;20
5 Progressiva Definitiva Retoque Dinheiro;dinheiro;1254;2h e 30 min;Cabelo;Preço Fixo;240;;0;0;0;0;0
6 Progressiva Definitiva Retoque Cartão;retoque raiz;2323;2h e 30 min;Cabelo;Preço Fixo;260;;0;0;0;0;0
Botox Cartão;cartão;2140;1h e 30 min;Cabelo;Preço Fixo;250;;0;0;20;20;20
Botox Dinheiro;Botox capilar;2640;45 min;Cabelo;A partir de;230;;0;0;0;0;0
Chapinha - Prancha;Somente Pranchar os Cabelos.;1356;20 min;Cabelo;Preço Fixo;15;;0;0;0;0;0
Chapinha Cartão;Lava-se os Cabelos, Escova-se e passa a Prancha.;1208;60 min;Cabelo;Preço Fixo;25;;0;0;10;10;10
Corte Feminino Cartão;corte cartão;7845;30 min;Cabelo;Preço Fixo;70;;0;0;10;10;10
Corte Feminino Dinheiro;"Corte de qualquer"" modelo, cartão 70,00""";2659;30 min;Cabelo;Preço Fixo;60;;0;0;0;0;0
Corte Infantil;Corte Infantil;1062;30 min;Cabelo;Preço Fixo;50;;0;0;0;0;0
Corte Masculino;Higienização e Secagem.;1063;30 min;Cabelo;Preço Fixo;40;;0;0;0;0;0
Corte PROGRESSIVA;Corte horizontal junto à progressiva;2661;45 min;Cabelo;Preço Fixo;60;;0;0;0;0;0
Escova Simples;Escova Simples, cabelo na nuca 40,00 valor em dinheiro/pix, cartão R$ 50,00;2702;45 min;Cabelo;A partir de;40;;0;0;0;0;0
Escova Simples Cartão;Escova Lisa;1214;1h e 30 min;Cabelo;Preço Fixo;70;;0;0;20;20;20
Hidratação;P: 70,00M: 100,00G: 140,00;2717;45 min;Cabelo;A partir de;80;;0;0;0;0;0
Lavagem simples;Higienização capilar;1909;30 min;Cabelo;Preço Fixo;15;;0;0;0;0;0
Mega Hair / Alongamento do Cabelo;Recurso para alongamento dos cabelos, o Mega Hair se adapta em qualquer estilo de cabelo. Traz resultados por cerca de 4 a 5 meses de duração. As mechas falsas são unidas às mechas do próprio cabelo com uma cola específica para fazer o Megahair.;1314;3h;Cabelo;Preço Fixo;300;;0;0;0;0;0
Progressiva  Definitiva Abaixo do sutiã;progressiva definitiva abaixo do sutiâ em até 4x sem juros;2415;3h;Cabelo;Preço Fixo;330;;0;0;0;0;0
Progressiva DEFINITIVA ?;Metade direita da Progressiva DEFINITIVA;8398;1h e 30 min;Cabelo;Preço Fixo;150;;0;0;0;0;0
Progressiva DEFINITIVA ?;Metade esquerda da Progressiva DEFINITIVA;11;1h e 30 min;Cabelo;Preço Fixo;150;;0;0;0;0;0
Progressiva Definitiva Altura do Sutiã;progressiva definitiva altura do sutiâ em até 4x sem juros;2457;3h;Cabelo;Preço Fixo;280;;0;0;0;0;0
Progressiva Definitiva Cartão;cartão;3254;5h;Cabelo;Preço Fixo;400;;0;0;0;0;0
Progressiva DEFINITIVA Refazer;Retorno de até 1 mês;2798;4h e 10 min;Cabelo;Preço Fixo;0;;0;0;0;0;0
Progressiva DEFINITIVA Refazer ?;Metade direita do retorno de Progressiva DEFINITIVA;9128;1h e 30 min;Cabelo;Preço Fixo;0;;0;0;0;0;0
Progressiva DEFINITIVA Refazer ?;Metade esquerda do retorno de Progressiva DEFINITIVA;1289;1h e 30 min;Cabelo;Preço Fixo;0;;0;0;0;0;0
Progressiva DEFINITIVA Retoque ? cartão;Metade direita do Retoque da DEFINITIVA;2561;1h e 30 min;Cabelo;Preço Fixo;115;;0;0;15;15;15
Progressiva DEFINITIVA Retoque ? Dinheiro Pix;Progressiva DEFINITIVA Retoque ? Dinheiro Pix;8457;3h;Cabelo;Preço Fixo;100;;0;0;0;0;0
Progressiva DEFINITIVA Retoque ? cartão;Metade esquerda do Retoque da DEFINITIVA;2807;1h e 30 min;Cabelo;Preço Fixo;115;;0;0;15;15;15
Progressiva DEFINITIVA Retoque ? Dinheiro Pix;Progressiva DEFINITIVA Retoque esquerdo;6352;3h;Cabelo;Preço Fixo;100;;0;0;0;0;0
Progressiva Definitiva Retoque Dinheiro;dinheiro;2541;3h;Cabelo;Preço Fixo;200;;0;0;0;0;0
Progressiva Definitiva T1;tamanho 1;1234;3h;Cabelo;Preço Fixo;320;;0;0;20;20;20
Progressiva Refazer;Retorno com até 07 dias, para refazer a progressiva;2797;3h;Cabelo;Preço Fixo;0;;0;0;0;0;0
Progressiva Refazer ?;Metade direita do retorno de progressiva;1820;1h e 30 min;Cabelo;Preço Fixo;0;;0;0;0;0;0
Progressiva Refazer ?;Metade direita do retorno de progressiva;2800;1h e 30 min;Cabelo;Preço Fixo;0;;0;0;0;0;0
Progressiva Semi ? Cartão;somente lado direito, cartão;2157;3h;Cabelo;Preço Fixo;100;;0;0;10;10;10
Progressiva Semi ? Dinheiro;Metade direita da progressiva;2612;1h e 30 min;Cabelo;A partir de;90;;0;0;0;0;0
Progressiva Semi ? Cartão;somente lado esquerda, cartão;7851;3h;Cabelo;Preço Fixo;100;;0;0;10;10;10
Progressiva Semi ? Dinheiro;Metade esquerda da progressiva;8310;1h e 30 min;Cabelo;A partir de;90;;0;0;0;0;0
Progressiva Semi Abaixo Sutiã;progressiva semi definitiva abaixo do sutiâ em até 4x sem juros;1258;3h;Cabelo;Preço Fixo;230;;0;0;0;0;0
Progressiva Semi Altura Sutiã;progressiva semi definitiva altura do sutiâ em até 4x sem juros;35;3h;Cabelo;Preço Fixo;210;;0;0;0;0;0
Progressiva Semi Def. Cartão;A escova progressiva sem formol alisa até 100% do cabelo. Conforto na aplicação, sem a ardência nos olhos e nas vias respiratórias. Além de ser compatível com qualquer tipo de química.;1223;3h;Cabelo;Preço Fixo;200;;0;0;20;20;20
Progressiva Semi Def. Dinheiro Pix;Progressiva Ultrassônica a Laser, promoção em Dinheiro ou Pix;2592;3h;Cabelo;Preço Fixo;180;;0;0;0;0;0
Reconstrução Chapinha Laser;Reconstrução com chapinha a laser;2796;45 min;Cabelo;Preço Fixo;90;;0;0;0;0;0
Selante Cartão;somente abaixar o volume;2145;3h;Cabelo;Preço Fixo;250;;0;0;20;20;20
Selante Dinheiro;Selante;2817;2h;Cabelo;Preço Fixo;230;;0;0;0;0;0
Tintura;Tintura com produto da cliente;2834;45 min;Cabelo;Preço Fixo;40;;0;0;0;0;0
Tintura Cartão;?;5647;30 min;Cabelo;Preço Fixo;50;;0;0;0;0;0
Baby Liss / Cachos;Cachos nos cabelos. Técnica pode ser realizada manualmente ou com babyliss. Os cachos estão em alta e dão um ar informal ao visual.;1014;60 min;Cabelo - Penteados;Preço Fixo;0;;0;0;0;0;0
Penteado;Penteado;1345;60 min;Cabelo - Penteados;Preço Fixo;0;;0;0;0;0;0
Ânus;Ânus masculino/feminino;2628;30 min;Depilação;Preço Fixo;15;;0;0;0;0;0
Axila;Axila feminina;2624;10 min;Depilação;Preço Fixo;15;;0;0;0;0;0
Axila Masc.;Axila masculina;2632;15 min;Depilação;Preço Fixo;25;;0;0;0;0;0
Barba;Barba;2636;45 min;Depilação;Preço Fixo;50;;0;0;0;0;0
Barriga;Barriga feminina;2637;30 min;Depilação;Preço Fixo;20;;0;0;0;0;0
Barriga Masc. Completa;Barriga masculina;2638;30 min;Depilação;Preço Fixo;65;;0;0;0;0;0
Braço Inteiro;Braço feminino inteiro;2641;30 min;Depilação;Preço Fixo;20;;0;0;0;0;0
Braço Inteiro Masc.;Braço masculino inteiro;2642;30 min;Depilação;Preço Fixo;30;;0;0;0;0;0
Buço;Buço feminino;2644;15 min;Depilação;Preço Fixo;15;;0;0;0;0;0
Buço Linha;Buço na linha;2645;15 min;Depilação;Preço Fixo;25;;0;0;0;0;0
Contorno Completo;Contorno cirúrgico feminino;2614;30 min;Depilação;Preço Fixo;45;;0;0;0;0;0
Contorno Completo Cartão;?;2357;20 min;Depilação;Preço Fixo;50;;0;0;0;0;0
Contorno Simples;Contorno simples feminino;2653;30 min;Depilação;Preço Fixo;35;;0;0;0;0;0
Costas;Costas femininas;2662;30 min;Depilação;Preço Fixo;30;;0;0;0;0;0
Costas Masc.;Costas masculinas;2663;30 min;Depilação;Preço Fixo;60;;0;0;0;0;0
Coxa;Coxa feminina;2604;30 min;Depilação;Preço Fixo;45;;0;0;0;0;0
Linha Alba;"A linha"" da barriga. A ""faixa""";2711;30 min;Depilação;Preço Fixo;10;;0;0;0;0;0
Meia perna;Meia perna feminina;2620;20 min;Depilação;Preço Fixo;35;;0;0;0;0;0
Nádegas;Nádegas feminino;2750;20 min;Depilação;Preço Fixo;35;;0;0;0;0;0
Nádegas Masc.;Nádegas masculinas;2752;20 min;Depilação;Preço Fixo;40;;0;0;0;0;0
Nariz;Nariz unissex;2753;15 min;Depilação;Preço Fixo;10;;0;0;0;0;0
Orelha;Orelha unissex;2756;15 min;Depilação;Preço Fixo;10;;0;0;0;0;0
Pacote Depilação Fem. Cartão;cartão;2147;30 min;Depilação;Preço Fixo;70;;0;0;10;10;10
Pacote Depilação Fem. Dinheiro;Pacote de depilação feminino. R$ 60,00 dinheiro em espécie. E Pix ou cartão 70,00.;2596;30 min;Depilação;Preço Fixo;60;;0;0;0;0;0
Pacote Depilação Masc.;Pacote de depilação masculino ( contorno completo, axila e orelha ) . Dinheiro/Pix,;2758;40 min;Depilação;Preço Fixo;80;;0;0;0;0;0
Pé;depilar o pé;5847;15 min;Depilação;Preço Fixo;15;;0;0;0;0;0
Peitoral Masc;peitoral masc;4521;30 min;Depilação;Preço Fixo;40;;0;0;0;0;0
Perna inteira;Perna feminina inteira;2622;30 min;Depilação;Preço Fixo;60;;0;0;0;0;0
Perna Inteira Masc.;Perna masculina inteira;2766;30 min;Depilação;Preço Fixo;65;;0;0;0;0;0
Pescoço Masc.;Pescoço masculino;2768;20 min;Depilação;Preço Fixo;25;;0;0;0;0;0
Pescoço/Nuca;Pescoço feminino;2767;20 min;Depilação;Preço Fixo;15;;0;0;0;0;0
Queixo;Queixo feminino;2794;15 min;Depilação;Preço Fixo;10;;0;0;0;0;0
Rosto;Rosto feminino;2813;20 min;Depilação;Preço Fixo;25;;0;0;0;0;0
Seios;Seios;2815;20 min;Depilação;Preço Fixo;15;;0;0;0;0;0
Testa;Testa unissex;2832;15 min;Depilação;Preço Fixo;10;;0;0;0;0;0
Tórax;Tórax;2836;20 min;Depilação;Preço Fixo;25;;0;0;0;0;0
Virilha Masc;Virilhas masculinas;2850;20 min;Depilação;Preço Fixo;45;;0;0;0;0;0
Black Peel;Sessão de black peel;3435;40 min;Estética Facial;Preço Fixo;300;;0;0;0;0;0
Design com henna;Design de sobrancelha com henna;2605;45 min;Estética Facial;Preço Fixo;55;;0;0;0;0;0
Design simples;Design de sobrancelha;2615;30 min;Estética Facial;Preço Fixo;45;;0;0;0;0;0
Micro;Micropigmentação de sobrancelhas (Nanoblading, Shadow e Shadowline);2745;60 min;Estética Facial;Preço Fixo;390;;0;0;0;0;0
Micro Labial;Micropigmentação dos lábios;2743;60 min;Estética Facial;Preço Fixo;390;;0;0;0;0;0
Neutralização Labial;Neutralização labial;2705;60 min;Estética Facial;Preço Fixo;270;;0;0;0;0;0
Olho ?;Micropigmentação da pálpebra superior;2755;60 min;Estética Facial;Preço Fixo;300;;0;0;0;0;0
Olho ?;Micropigmentação da pálpebra inferior;2754;60 min;Estética Facial;Preço Fixo;300;;0;0;0;0;0
Remoção Micro;Sessão de remoção a laser de micropigmentação;215;30 min;Estética Facial;Preço Fixo;200;;0;0;0;0;0
Remoção Tatuagem;Sessão de remoção a laser de tatuagem;275;60 min;Estética Facial;Preço Fixo;0;;0;0;0;0;0
Sobrancelha Definitiva Cartão;cartão;5426;2h;Estética Facial;Preço Fixo;170;;0;0;20;20;20
Sobrancelha Definitiva Dinheiro;"Micropigmentação de sobrancelha, promoção em Dinheiro ou Pix(sobrancelha definitiva"")""";2599;1h e 30 min;Estética Facial;Preço Fixo;200;;0;0;0;0;0
Sobrancelha RETOQUE;Retoque de micropigmentação de sobrancelha;2608;45 min;Estética Facial;Preço Fixo;100;;0;0;0;0;0
1 Francesinha;francesinha no pé ou na mão;4;20 min;MANICURE E PEDICURE;Preço Fixo;2;;0;0;0;0;0
Esmaltagem;Pintura das unhas;2771;15 min;MANICURE E PEDICURE;Preço Fixo;25;;0;0;0;0;0
Pé e Mão;Pé e mão por R$ 35,00 somente pelo aplicativo. Fora do Aplicativo é R$ 60,00  Cartão R$ 65,00.;2597;60 min;MANICURE E PEDICURE;Preço Fixo;60;;0;0;0;0;0
Pé e Mão Cartão;cartão;8452;60 min;MANICURE E PEDICURE;Preço Fixo;65;;0;0;10;10;10
Pé e Mão Pelo Aplicativo;pelo aplicativo;2458;60 min;MANICURE E PEDICURE;Preço Fixo;35;;0;0;0;0;0
Pé ou Mão 30,00;sem antecipação;1247;30 min;MANICURE E PEDICURE;Preço Fixo;30;;0;0;0;0;0
Pé ou Mão pelo aplicativo;Favor agendar no aplicativo somente o serviço que for realmente fazer, pé e mão / pé ou mão.;2823;30 min;MANICURE E PEDICURE;Preço Fixo;25;;0;0;0;0;0
Design de Sobrancelha;Design de Sobrancelha;1187;30 min;Sobrancelha;Preço Fixo;0;;0;0;0;0;0
Pintura Sobrancelhas - Henna;Pintura Sobrancelhas - Henna;1359;30 min;Sobrancelha;Preço Fixo;0;;0;0;0;0;0
Sobrancelha com Linha;Permite um design moderno sem dor, totalmente confortável.;1388;30 min;Sobrancelha;Preço Fixo;0;;0;0;0;0;0
Sobrancelha na Cera;Sobrancelha na Cera;1389;30 min;Sobrancelha;Preço Fixo;0;;0;0;0;0;0
Sobrancelha na Pinça;Sobrancelha na Pinça;1390;30 min;Sobrancelha;Preço Fixo;0;;0;0;0;0;0`

// Parse function for duration
function parseDuration(durationStr) {
  if (!durationStr) return 0
  let minutes = 0
  const matchH = durationStr.match(/(\d+)\s*h/)
  if (matchH) minutes += parseInt(matchH[1]) * 60
  const matchM = durationStr.match(/(\d+)\s*min/)
  if (matchM) minutes += parseInt(matchM[1])
  
  if (!matchH && !matchM) {
    const num = parseInt(durationStr.replace(/\D/g, ''))
    if (!isNaN(num)) minutes += num
  }
  return minutes || 30 // Default 30 min
}

// Normalize name for deduplication
function normalize(str) {
  if (!str) return ""
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
}

// Map price type
function mapPriceType(type) {
  if (!type) return "fixed"
  if (type.toLowerCase().includes("partir")) return "starting_at"
  return "fixed"
}

// Slugify helper
function slugify(text) {
  return text.toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

async function main() {
  console.log("Iniciando importação de serviços...\n")
  
  // 1. Load Categories
  const categoriesSnap = await getDocs(collection(db, "categories"))
  const categoriesMap = new Map()
  categoriesSnap.docs.forEach(doc => {
    const data = doc.data()
    categoriesMap.set(normalize(data.name), { id: doc.id, ...data })
  })

  // 2. Load Existing Services
  const servicesSnap = await getDocs(collection(db, "services"))
  const existingServices = []
  servicesSnap.docs.forEach(doc => {
    existingServices.push({ id: doc.id, ...doc.data() })
  })
  
  const lines = csvData.trim().split("\n")
  const header = lines.shift() // ignore header
  
  let createdCount = 0
  let updatedCount = 0
  let ignoredCount = 0
  let catCreatedCount = 0
  let errorsCount = 0
  
  for (const line of lines) {
    if (!line.trim()) continue
    
    // Split by semicolons, handling quotes just in case
    // For this simple CSV, a basic split works well enough
    let cols = []
    let inQuotes = false
    let current = ""
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes
      } else if (line[i] === ';' && !inQuotes) {
        cols.push(current)
        current = ""
      } else {
        current += line[i]
      }
    }
    cols.push(current)
    
    const rawName = cols[0]
    const rawDesc = cols[1]
    const rawCode = cols[2]
    const rawDur = cols[3]
    const rawCat = cols[4]
    const rawPriceType = cols[5]
    const rawPrice = cols[6]
    const rawPromo = cols[7]
    const rawProdCost = cols[8]
    const rawProfProdCost = cols[9]
    const rawDisp = cols[10]
    const rawEstCost = cols[11]
    const rawProfCost = cols[12]
    
    if (!rawName) continue
    
    try {
      // Resolve Category
      let categoryId = null
      if (rawCat && rawCat.trim()) {
        const catNorm = normalize(rawCat)
        if (categoriesMap.has(catNorm)) {
          categoryId = categoriesMap.get(catNorm).id
        } else {
          // Create new category
          const newCat = {
            company_id: "default",
            name: rawCat.trim(),
            slug: slugify(rawCat.trim()),
            description: null,
            icon: null,
            display_order: categoriesMap.size,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          const catRef = await addDoc(collection(db, "categories"), newCat)
          categoryId = catRef.id
          categoriesMap.set(catNorm, { id: categoryId, ...newCat })
          catCreatedCount++
          console.log(`[+] Categoria criada: ${rawCat.trim()}`)
        }
      }
      
      const priceVal = rawPrice ? parseFloat(rawPrice.replace(',', '.')) : 0
      
      const serviceData = {
        name: rawName.trim().replace(/^"|"$/g, ''),
        description: rawDesc ? rawDesc.trim().replace(/^"|"$/g, '') : null,
        service_code: rawCode ? rawCode.trim() : null,
        duration_minutes: parseDuration(rawDur),
        category_id: categoryId,
        price_type: mapPriceType(rawPriceType),
        price: isNaN(priceVal) ? 0 : priceVal,
        promotional_price: rawPromo ? parseFloat(rawPromo.replace(',', '.')) || null : null,
        product_average_cost: rawProdCost ? parseFloat(rawProdCost.replace(',', '.')) || 0 : 0,
        professional_product_average_cost: rawProfProdCost ? parseFloat(rawProfProdCost.replace(',', '.')) || 0 : 0,
        disposable_expenses: rawDisp ? parseFloat(rawDisp.replace(',', '.')) || 0 : 0,
        establishment_operational_cost: rawEstCost ? parseFloat(rawEstCost.replace(',', '.')) || 0 : 0,
        professional_operational_cost: rawProfCost ? parseFloat(rawProfCost.replace(',', '.')) || 0 : 0,
        is_active: true,
        company_id: "default",
      }
      
      // Deduplication check
      // 1. By code
      // 2. By name + category match
      const normName = normalize(serviceData.name)
      const existing = existingServices.find(es => {
        if (serviceData.service_code && es.service_code === serviceData.service_code) return true
        if (normalize(es.name) === normName) {
            // Same name. If we are strict, check category.
            // Some existing services might not have categories. 
            // Better to assume if name matches exactly, it's the same service.
            return true
        }
        return false
      })
      
      if (existing) {
        // Update
        await updateDoc(doc(db, "services", existing.id), {
          ...serviceData,
          updated_at: new Date().toISOString()
        })
        updatedCount++
        console.log(`[~] Atualizado: ${serviceData.name} (Código: ${serviceData.service_code || 'N/A'})`)
      } else {
        // Create
        await addDoc(collection(db, "services"), {
          ...serviceData,
          display_order: existingServices.length + createdCount,
          featured: false,
          image_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        createdCount++
        console.log(`[+] Criado: ${serviceData.name}`)
      }
      
    } catch (err) {
      console.error(`[-] Erro na linha: ${rawName}`, err.message)
      errorsCount++
    }
  }
  
  console.log("\n==============================")
  console.log("Relatório Final da Importação:")
  console.log(`Total de linhas lidas: ${lines.length}`)
  console.log(`Serviços criados: ${createdCount}`)
  console.log(`Serviços atualizados: ${updatedCount}`)
  console.log(`Categorias criadas: ${catCreatedCount}`)
  console.log(`Erros: ${errorsCount}`)
  console.log("==============================\n")
  
  process.exit(0)
}

main().catch(err => {
  console.error("Erro fatal:", err)
  process.exit(1)
})
