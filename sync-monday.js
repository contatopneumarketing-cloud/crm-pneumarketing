// api/sync-monday.js — Vercel Serverless Function
// Busca leads dos 3 boards Monday e retorna JSON unificado

const MONDAY_TOKEN = process.env.MONDAY_TOKEN;

const BOARDS = [
  { id: '18415073072', src: 'Formulário', phoneCol: 'text_mm3s9dp' },
  { id: '18417945184', src: 'Página de vendas', phoneCol: 'text_mm4cw9fe' },
  { id: '18417602443', src: 'Instagram', phoneCol: 'phonecpv8nesp' },
];

async function fetchBoardItems(boardId, phoneCol) {
  const query = `
    query {
      boards(ids: [${boardId}]) {
        items_page(limit: 200) {
          items {
            id
            name
            created_at
            column_values(ids: ["${phoneCol}"]) {
              id
              text
            }
          }
        }
      }
    }
  `;

  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': MONDAY_TOKEN,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error(`Monday API error: ${res.status}`);
  const data = await res.json();
  return data?.data?.boards?.[0]?.items_page?.items || [];
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!MONDAY_TOKEN) {
    return res.status(500).json({ error: 'MONDAY_TOKEN não configurado' });
  }

  try {
    const allLeads = [];

    await Promise.all(BOARDS.map(async (board) => {
      const items = await fetchBoardItems(board.id, board.phoneCol);
      items.forEach(item => {
        const phone = item.column_values?.[0]?.text || '';
        allLeads.push({
          id: item.id,
          name: item.name,
          phone: phone.replace(/\s/g, ''),
          src: board.src,
          created: item.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        });
      });
    }));

    res.status(200).json({ leads: allLeads, total: allLeads.length, synced_at: new Date().toISOString() });
  } catch (e) {
    console.error('Sync error:', e);
    res.status(500).json({ error: e.message });
  }
}
