import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html className="light" lang="en">
      <Head>
        <meta name="description" content="Taskra: Autonomous AI Agent Marketplace running on the Somnia blockchain L2 network" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/fonts/geist-sans/style.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/fonts/geist-mono/style.css" />
      </Head>
      <body className="bg-background dark:bg-zinc-950 text-on-surface dark:text-zinc-100 font-body selection:bg-primary-fixed dark:selection:bg-cyan-500/30 selection:text-primary dark:selection:text-cyan-400 transition-colors duration-300">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
