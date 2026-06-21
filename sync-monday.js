const MONDAY_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjY2NDgxNjc0NiwiYWFpIjoxMSwidWlkIjoxMDQxODQ2MTUsImlhZCI6IjIwMjYtMDUtMzBUMDI6MTU6MTcuMDAwWiIsInBlciI6Im1lOndyaXRlIiwiYWN0aWQiOjM1Mjc4MzA0LCJyZ24iOiJ1c2UxIn0.TXHhga14QybrpTlqGQK8HoG-8V-Miy41nC3UMdC_o64';

const BOARDS = [
  { id: '18415073072', src: 'Formulario', phoneCol: 'text_mm3s9dp' },
  { id: '18417945184', src: 'Pagina de vendas', phoneCol: 'text_mm4cw9fe' },
  { id: '18417602443', src: 'Instagram', phoneCol: 'phonecpv8nesp' },
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const allLeads = [];
    await Promise.all(BOARDS.map(async (board) => {
      const query = `query { boards(ids: [${board.id}]) { items_page(limit: 200) { items { id name created_at column_values(ids: ["${board.phoneCol}"]) { text } } } } }`;
      const r = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': MONDAY_TOKEN, 'API-Version': '2024-10' },
        body: JSON.stringify({ query }),
      });
      const data = await r.json();
      const items = data?.data?.boards?.[0]?.items_page?.items || [];
      items.forEach(item => {
        allLeads.push({
          id: item.id,
          name: item.name,
          phone: (item.column_values?.[0]?.text || '').replace(/\s/g, ''),
          src: board.src,
          created: item.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        });
      });
    }));
    res.status(200).json({ leads: allLeads, total: allLeads.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
