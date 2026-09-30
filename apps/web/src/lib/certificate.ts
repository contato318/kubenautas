import type { Certificate } from '@jack-academy/contracts';
import jackAcademyLogo from '../assets/jack-academy-logo.svg';
import jackAcademyMark from '../assets/jack-academy-mark.svg';

export function certificateDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

function wrapName(context: CanvasRenderingContext2D, name: string, width: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of name.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width <= width) { line = next; continue; }
    if (line) lines.push(line);
    line = '';
    for (const character of word) {
      if (context.measureText(line + character).width > width) { lines.push(line); line = ''; }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** One high-resolution design is used for both the preview and the PDF. */
export async function renderCertificate(certificate: Certificate): Promise<string> {
  const logo = new Image();
  logo.src = jackAcademyLogo;
  const mark = new Image();
  mark.src = jackAcademyMark;
  await Promise.all([logo.decode(), mark.decode(), document.fonts.ready]);
  let qr: HTMLCanvasElement | null = null;
  if (certificate.verificationUrl) {
    const { default: QRCode } = await import('qrcode');
    qr = document.createElement('canvas');
    await QRCode.toCanvas(qr, certificate.verificationUrl, { width: 336, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#101d35', light: '#faf9f5' } });
  }
  const canvas = document.createElement('canvas');
  const width = 1120;
  const height = 792;
  canvas.width = width * 3;
  canvas.height = height * 3;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.scale(3, 3);
  const navy = '#101d35';
  const blue = '#326ce5';
  const gold = '#c69a3b';
  ctx.fillStyle = '#faf9f5';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = navy;
  ctx.fillRect(0, 0, width, 144);
  ctx.fillRect(0, 144, 16, height - 144);
  ctx.fillStyle = gold;
  ctx.fillRect(0, 144, width, 4);
  ctx.strokeStyle = '#d9d3c4';
  ctx.lineWidth = 1;
  ctx.strokeRect(42, 175, width - 84, height - 217);
  ctx.textBaseline = 'alphabetic';
  ctx.drawImage(logo, 64, 24, 170, 170 * logo.naturalHeight / logo.naturalWidth);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#b8c5df';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText('APRENDA KUBERNETES NA PRÁTICA', 1054, 71);
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText('UMA INICIATIVA JACK EXPERTS', 1054, 94);

  const centered = (text: string, y: number, font: string, color = navy) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, width / 2, y);
  };
  centered('CERTIFICADO', 228, '700 32px Inter, sans-serif');
  centered('DE APROVAÇÃO', 251, '12px Inter, sans-serif', '#806021');
  centered('Certificamos que', 292, '17px Inter, sans-serif', '#626c7a');
  let nameSize = 44;
  let nameLines: string[] = [];
  for (; nameSize >= 14; nameSize -= 2) {
    ctx.font = `600 ${nameSize}px Georgia, serif`;
    nameLines = wrapName(ctx, certificate.fullName, 940);
    if (nameLines.length <= 2) break;
  }
  nameLines.forEach((line, index) => centered(line, nameLines.length === 1 ? 355 : 333 + index * (nameSize + 9), `600 ${nameSize}px Georgia, serif`));
  centered('obteve aprovação na avaliação final da plataforma Jack Academy,', 419, '17px Inter, sans-serif', '#475569');
  centered('em Kubernetes na prática.', 446, '600 19px Inter, sans-serif');

  ctx.strokeStyle = '#e1dccf';
  ctx.beginPath(); ctx.moveTo(132, 478); ctx.lineTo(988, 478); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#657081';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText('APROVEITAMENTO', 305, 517);
  ctx.fillText('DATA DE EMISSÃO', 815, 517);
  ctx.fillStyle = navy;
  ctx.font = '700 30px Inter, sans-serif';
  ctx.fillText(`${Math.round(certificate.examScore * 100)}%`, 305, 558);
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText(certificateDate(certificate.issuedAt), 815, 552);

  ctx.drawImage(mark, 525, 502, 70, 70);
  ctx.lineWidth = 1;
  ctx.strokeStyle = gold;
  ctx.beginPath(); ctx.moveTo(398, 614); ctx.lineTo(722, 614); ctx.stroke();
  centered('Jack Academy', 642, '700 17px Inter, sans-serif');
  centered('Uma iniciativa Jack Experts', 664, '12px Inter, sans-serif', '#657081');
  if (qr) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qr, 886, 623, 112, 112);
    ctx.textAlign = 'left';
    ctx.fillStyle = navy;
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText('VALIDE A AUTENTICIDADE', 108, 688);
    ctx.fillStyle = '#657081';
    ctx.font = '10px monospace';
    ctx.fillText(`Identificador: ${certificate.id}`, 108, 708);
    let linkSize = 11;
    do { ctx.font = `${linkSize}px Inter, sans-serif`; linkSize -= 0.5; } while (ctx.measureText(certificate.verificationUrl).width > 745 && linkSize >= 6);
    ctx.fillStyle = '#2555c0';
    ctx.fillText(certificate.verificationUrl, 108, 730, 745);
    ctx.textAlign = 'center';
    ctx.font = '8px Inter, sans-serif';
    ctx.fillStyle = '#657081';
    ctx.fillText('Escaneie para validar', 942, 744);
  } else {
    centered(`Identificador: ${certificate.id}`, 716, '11px monospace', '#657081');
  }
  ctx.fillStyle = blue;
  ctx.beginPath(); ctx.moveTo(1010, height); ctx.lineTo(width, height - 110); ctx.lineTo(width, height); ctx.fill();
  return canvas.toDataURL('image/png');
}

export async function certificatePdf(certificate: Certificate): Promise<Uint8Array> {
  const [{ PDFDocument, PDFString }, png] = await Promise.all([import('pdf-lib'), renderCertificate(certificate)]);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificado Jack Academy — ${certificate.fullName}`);
  pdf.setAuthor('Jack Academy');
  pdf.setSubject(`Aprovação na avaliação final de Kubernetes na prática. Identificador: ${certificate.id}${certificate.verificationUrl ? `. Verificação: ${certificate.verificationUrl}` : ''}`);
  pdf.setLanguage('pt-BR');
  pdf.setCreationDate(new Date(certificate.issuedAt));
  pdf.setModificationDate(new Date(certificate.issuedAt));
  const page = pdf.addPage([841.89, 595.28]);
  const image = await pdf.embedPng(png);
  page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  if (certificate.verificationUrl) {
    // PDF coordinates start at the bottom; the canvas design starts at the top.
    for (const [x, y, width, height] of [[104, 714, 754, 24], [882, 619, 120, 128]]) {
      const scaleX = page.getWidth() / 1120;
      const scaleY = page.getHeight() / 792;
      page.node.addAnnot(pdf.context.register(pdf.context.obj({
        Type: 'Annot', Subtype: 'Link',
        Rect: [x * scaleX, (792 - y - height) * scaleY, (x + width) * scaleX, (792 - y) * scaleY],
        Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: PDFString.of(certificate.verificationUrl) },
      })));
    }
  }
  return pdf.save();
}
