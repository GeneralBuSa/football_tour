import { pageMetadata } from '../shared/siteConfig.js';

export const metadata = pageMetadata({
  title: 'Giriş Yap veya Kayıt Ol',
  description: 'Football Tour Simulator hesabına giriş yap, yeni hesap oluştur veya şifreni sıfırla.',
  path: '/auth', noindex: true
});

export default function AuthLayout({ children }) {
  return children;
}
