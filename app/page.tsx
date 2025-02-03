"use client"

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from "@/app/components/Navbar";
import Login from "@/app/components/Login";
import Register from "@/app/components/Register";
import './globals.css';
import { Button } from "@/components/ui/button";

export default function Home() {
  const { isLoggedIn, username, login, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(true);

  const handleLogin = (loggedInUsername: string) => {
    login(loggedInUsername);
  };

  const handleLogout = () => {
    logout();
  };

  const switchToRegister = () => setShowLogin(false);
  const switchToLogin = () => setShowLogin(true);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        {showLogin ? (
          <Login onLogin={handleLogin} onSwitchToRegister={switchToRegister} />
        ) : (
          <Register onSwitchToLogin={switchToLogin} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      <Navbar />
      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl w-full space-y-8 text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl sm:tracking-tight lg:text-6xl">
            Bienvenido a nuestra plataforma
          </h1>
          <p className="mt-5 text-xl text-gray-500 dark:text-gray-400">
            Estamos encantados de tenerte aquí, {username}. Explora nuestras funcionalidades y descubre todo lo que podemos ofrecerte.
          </p>
        </div>
      </main>
      <footer className="bg-white dark:bg-gray-800 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            © 2024 Tu Empresa. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

