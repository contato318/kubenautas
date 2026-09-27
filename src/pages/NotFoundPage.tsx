import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <div className="font-mono text-signal-red">Error from server (NotFound): pages "{window.location.pathname}" not found</div>
      <Link to="/" className="btn-primary mt-8">Voltar ao início</Link>
    </div>
  );
}
