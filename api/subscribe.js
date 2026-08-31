import { sql } from '@vercel/postgres';
import { Resend } from 'resend';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  try {
    const { name, email, role, company } = req.body || {};

    // ---- Validation côté serveur ----
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Adresse e-mail requise.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: 'Adresse e-mail invalide.' });
    }

    if (role !== 'particulier' && role !== 'entreprise') {
      return res.status(400).json({ error: 'Type de compte invalide.' });
    }

    const cleanName = (name || '').toString().trim().slice(0, 100);
    if (!cleanName) {
      return res.status(400).json({ error: 'Prénom requis.' });
    }

    const cleanCompany = (company || '').toString().trim().slice(0, 150);
    if (role === 'entreprise' && !cleanCompany) {
      return res.status(400).json({ error: "Nom de l'établissement requis." });
    }

    // ---- Enregistrement dans Neon (email unique -> pas de doublon) ----
    const insertResult = await sql`
      INSERT INTO waitlist (name, email, role, company)
      VALUES (${cleanName}, ${cleanEmail}, ${role}, ${cleanCompany || null})
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `;

    const isNewSubscriber = insertResult.rowCount > 0;

    // ---- Notification e-mail (uniquement pour une nouvelle inscription) ----
    if (isNewSubscriber && process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
          to: process.env.NOTIFY_EMAIL,
          subject: 'Nouvelle inscription LASTDEAL',
          text: `Nouvelle inscription LASTDEAL\n\nEmail : ${cleanEmail}\nType : ${role === 'entreprise' ? 'Entreprise' : 'Particulier'}${cleanCompany ? `\nÉtablissement : ${cleanCompany}` : ''}\nDate : ${now}`
        });
      } catch (emailErr) {
        console.error('Erreur notification e-mail:', emailErr);
      }
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Erreur /api/subscribe:', err);
    return res.status(500).json({ error: 'Erreur serveur, réessayez plus tard.' });
  }
}
