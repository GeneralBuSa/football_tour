import '../../css/style.css';

export const metadata = {
  title: 'Football Tour Simulator — 3D',
  description: 'Football Tour Simulator — 3D İzometrik Masa Oyunu',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
