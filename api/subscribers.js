import { sql } from '@vercel/postgres';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export default async function handler(req, res) {
  const token = req.query.token;

  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).send('Non autorisé. Ajoutez ?token=VOTRE_TOKEN à l\'URL.');
  }

  const { rows } = await sql`
    SELECT name, email, role, company, created_at
    FROM waitlist
    ORDER BY created_at DESC
  `;

  if (req.query.format === 'json') {
    return res.status(200).json(rows);
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Inscriptions Lastdeal</title>
<style>
  body{font-family:'Segoe UI',sans-serif;background:#FBF4E8;color:#0E1B24;padding:40px;}
  h1{font-size:22px;margin-bottom:20px;}
  table{border-collapse:collapse;width:100%;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,0.06);}
  th,td{padding:10px 14px;border-bottom:1px solid #eee;text-align:left;font-size:14px;}
  th{background:#0A3550;color:#FBF4E8;position:sticky;top:0;}
  tr:hover{background:#f5f0e6;}
  .tag{display:inline-block;padding:2px 8px;border-radius:3px;font-size:12px;font-weight:600;}
  .tag.particulier{background:#2F8FB0;color:#fff;}
  .tag.entreprise{background:#F0B24C;color:#0E1B24;}
</style>
</head>
<body>
  <h1>Inscriptions Lastdeal — ${rows.length} au total</h1>
  <table>
    <tr><th>Date</th><th>Prénom</th><th>Email</th><th>Type</th><th>Établissement</th></tr>
    ${rows.map(r => `
    <tr>
      <td>${new Date(r.created_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</td>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.email)}</td>
      <td><span class="tag ${r.role}">${r.role === 'entreprise' ? 'Entreprise' : 'Particulier'}</span></td>
      <td>${r.company ? escapeHtml(r.company) : '—'}</td>
    </tr>`).join('')}
  </table>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
