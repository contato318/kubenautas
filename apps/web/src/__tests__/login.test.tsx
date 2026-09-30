// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@jack-academy/contracts';
import LoginPage from '../pages/LoginPage';
import AccountMenu from '../components/AccountMenu';

let user: User | null;
vi.mock('../auth/AccountProvider', () => ({ useAccount: () => ({ user, status: 'ready', providers: { google: true, github: true } }) }));
vi.mock('../components/LoginDiscoveries', () => ({ default: () => null }));
vi.mock('motion/react', async (original) => ({ ...await original<typeof import('motion/react')>(), useReducedMotion: () => true }));
beforeEach(() => { user = { id: 'student', name: 'Estudante', email: null, avatarUrl: null, provider: 'google', welcomeCompleted: false, isAdmin: false }; });
afterEach(cleanup);

function Destination() {
  const { pathname, search, hash } = useLocation();
  return <p data-testid="destination">{pathname + search + hash}</p>;
}

function renderLogin(target?: string, basename = '/') {
  const prefix = basename === '/' ? '' : basename;
  render(
    <MemoryRouter basename={basename} initialEntries={[`${prefix}/entrar${target === undefined ? '' : `?returnTo=${encodeURIComponent(target)}`}`]}>
      <Routes>
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('login destination', () => {
  it.each([false, true])('returns to the exact requested page regardless of welcome completion (%s)', async (welcomeCompleted) => {
    user!.welcomeCompleted = welcomeCompleted;
    const target = '/aprender/containers/dockerfile?tab=quiz#perguntas';
    renderLogin(target);
    expect((await screen.findByTestId('destination')).textContent).toBe(target);
  });

  it.each(['/prova', '/casos/crashloop-config', '/admin/usuarios?page=2#lista', '/'])('returns to %s after a login prompt', async (target) => {
    renderLogin(target);
    expect((await screen.findByTestId('destination')).textContent).toBe(target);
  });

  it.each([undefined, '', '//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/entrar?returnTo=/prova', '/x/../entrar', '/%65ntrar', '/%2f%2fevil.example', '/%5cevil.example'])('falls back to the trail for missing or unsafe destinations (%s)', async (target) => {
    renderLogin(target);
    expect((await screen.findByTestId('destination')).textContent).toBe('/trilha');
  });

  it('keeps the destination relative to the app when deployed under a base path', async () => {
    renderLogin('/prova?modo=treino#iniciar', '/jack-academy');
    expect((await screen.findByTestId('destination')).textContent).toBe('/prova?modo=treino#iniciar');
  });

  it('passes the exact destination to both OAuth providers', () => {
    user = null;
    const target = '/aprender/containers/dockerfile?tab=quiz&modo=revisao#perguntas';
    renderLogin(target);
    for (const provider of ['Google', 'GitHub']) {
      const link = screen.getByRole('link', { name: `Entrar com ${provider}` });
      const url = new URL(link.getAttribute('href')!, 'https://jack-academy.test');
      expect(url.pathname).toBe(`/api/auth/${provider.toLowerCase()}`);
      expect(url.searchParams.get('returnTo')).toBe(target);
    }
  });

  it('includes the current query and fragment when entering through the account menu', () => {
    user = null;
    const source = '/simuladores/terminal?cenario=deploy#missao';
    render(<MemoryRouter initialEntries={[source]}><AccountMenu /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Entrar' }).getAttribute('href')).toBe(`/entrar?returnTo=${encodeURIComponent(source)}`);
  });
});
