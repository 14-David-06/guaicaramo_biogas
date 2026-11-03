'use client';

import { useState } from 'react';
import { User } from '@/hooks/useAuth';
import Image from 'next/image';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';

interface LoginProps {
  onBack: () => void;
  onLoginSuccess?: (user: User) => void;
}

// Campos más altos y con letra grande: se llenan en celular, a veces al sol.
const campoGrande = `${claseCampo.replace('py-2.5', 'py-3.5')} text-lg`;

const DESCRIPCION_PASO = {
  cedula: 'Escriba su número de cédula para continuar.',
  new_password: 'Es su primer ingreso: cree una contraseña de al menos 6 caracteres.',
  password: 'Escriba su contraseña.'
};

function Girando() {
  return <span className="w-5 h-5 rounded-full border-[3px] border-white/40 border-t-white animate-spin" aria-hidden="true" />;
}

/** Quién está ingresando, una vez reconocida la cédula. */
function DatosUsuario({ usuario, cedula }: { usuario: User | null; cedula: string }) {
  return (
    <dl className="bg-superficie-2 border border-linea rounded-lg px-4 py-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {usuario ? (
        <>
          <dt className="text-tinta-suave">Nombre</dt>
          <dd className="font-semibold text-tinta">{usuario.nombre}</dd>
          <dt className="text-tinta-suave">Cargo</dt>
          <dd className="text-tinta">{usuario.cargo}</dd>
          <dt className="text-tinta-suave">Cédula</dt>
          <dd className="text-tinta tabular-nums">{usuario.cedula}</dd>
        </>
      ) : (
        <>
          <dt className="text-tinta-suave">Cédula</dt>
          <dd className="text-tinta tabular-nums">{cedula}</dd>
        </>
      )}
    </dl>
  );
}

export default function Login({ onBack, onLoginSuccess }: LoginProps) {
  const [step, setStep] = useState<'cedula' | 'new_password' | 'password'>('cedula');
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const [recordId, setRecordId] = useState<string>('');

  const handleCedulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Solo permitir dígitos numéricos, sin mostrar mensaje de error
    const onlyDigits = e.target.value.replace(/\D/g, '');
    setCedula(onlyDigits);
  };

  const handleCedulaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!cedula) {
      setError('Escriba su número de cédula.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'check_cedula',
          cedula: cedula.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo verificar la cédula. Intente de nuevo.');
      }

      if (!data.exists) {
        setError('No hay ningún usuario con esa cédula. Revise el número e intente de nuevo.');
        return;
      }

      setUserInfo(data.user);
      setRecordId(data.user?.id || '');

      if (data.hasPassword) {
        setStep('password');
      } else {
        setStep('new_password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con el servidor. Revise la conexión e intente de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('Escriba la contraseña que quiere usar.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las dos contraseñas no coinciden. Escríbalas de nuevo.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'set_password',
          cedula,
          recordId,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar la contraseña. Intente de nuevo.');
      }

      if (onLoginSuccess && userInfo) {
        onLoginSuccess(userInfo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con el servidor. Revise la conexión e intente de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('Escriba su contraseña.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'login',
          cedula,
          recordId,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo ingresar. Revise la contraseña e intente de nuevo.');
      }

      if (onLoginSuccess) {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con el servidor. Revise la conexión e intente de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'password' || step === 'new_password') {
      setStep('cedula');
      setPassword('');
      setConfirmPassword('');
      setError('');
      setUserInfo(null);
      setRecordId('');
    } else {
      onBack();
    }
  };

  const botonPrincipal = `${claseBoton('primario', 'lg')} w-full min-h-[52px]`;

  return (
    <div className="min-h-screen relative bg-tinta flex items-center justify-center lg:justify-start px-4 py-10 lg:pl-[8vw]">
      {/* La planta de fondo, con un velo oscuro para que la tarjeta sea lo que se lee. */}
      <div className="absolute inset-0 z-0">
        <Image src="/DSC_3884-Mejorado-NR_ghtz72.jpg" alt="" fill priority sizes="100vw" className="object-cover object-[65%_center]" />
        <div className="absolute inset-0 bg-[#141b12]/65" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-superficie border border-linea rounded-xl shadow-2xl p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <Image
              src="/logo-guaicaramo.png"
              alt="Guaicaramo"
              width={201}
              height={80}
              className="h-16 sm:h-20 w-auto"
              priority
            />
            <h1 className="mt-4 font-condensada font-bold text-3xl text-tinta leading-tight">Ingresar a la plataforma</h1>
            <p className="mt-1 text-tinta-suave">{DESCRIPCION_PASO[step]}</p>
          </div>

          <div className="mt-6">
            {step === 'cedula' ? (
              <form onSubmit={handleCedulaSubmit} className="space-y-5">
                <div>
                  <label htmlFor="cedula" className={claseEtiqueta}>
                    Número de cédula
                  </label>
                  <input
                    type="text"
                    id="cedula"
                    value={cedula}
                    onChange={handleCedulaChange}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={15}
                    className={`${campoGrande} tabular-nums`}
                    placeholder="Ej.: 1234567890"
                    autoComplete="username"
                  />
                </div>

                {error && <Aviso tono="error">{error}</Aviso>}

                <button type="submit" disabled={isLoading} className={botonPrincipal}>
                  {isLoading ? (
                    <>
                      <Girando />
                      Verificando…
                    </>
                  ) : (
                    'Continuar'
                  )}
                </button>
              </form>
            ) : step === 'new_password' ? (
              <form onSubmit={handleNewPasswordSubmit} className="space-y-5">
                {userInfo && <DatosUsuario usuario={userInfo} cedula={cedula} />}

                <div>
                  <label htmlFor="newPassword" className={claseEtiqueta}>
                    Nueva contraseña
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={campoGrande}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className={claseEtiqueta}>
                    Repita la contraseña
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={campoGrande}
                    placeholder="Escríbala otra vez"
                    autoComplete="new-password"
                  />
                </div>

                {error && <Aviso tono="error">{error}</Aviso>}

                <button type="submit" disabled={isLoading} className={botonPrincipal}>
                  {isLoading ? (
                    <>
                      <Girando />
                      Guardando…
                    </>
                  ) : (
                    'Guardar contraseña e ingresar'
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <DatosUsuario usuario={userInfo} cedula={cedula} />

                <div>
                  <label htmlFor="password" className={claseEtiqueta}>
                    Contraseña
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={campoGrande}
                    autoComplete="current-password"
                  />
                </div>

                {error && <Aviso tono="error">{error}</Aviso>}

                <button type="submit" disabled={isLoading} className={botonPrincipal}>
                  {isLoading ? (
                    <>
                      <Girando />
                      Ingresando…
                    </>
                  ) : (
                    'Ingresar'
                  )}
                </button>
              </form>
            )}

            <button type="button" onClick={handleBack} className={`${claseBoton('secundario')} w-full mt-3 min-h-[48px]`}>
              {step === 'cedula' ? 'Volver al inicio' : 'Usar otra cédula'}
            </button>
          </div>

          <p className="mt-6 pt-5 border-t border-linea text-center text-tinta-suave">
            ¿Problemas para ingresar?{' '}
            <a href="#contacto" className="font-semibold text-bosque underline underline-offset-2">
              Contacte a soporte
            </a>
          </p>
        </div>

        <p className="mt-4 text-center lg:text-left font-semibold text-white">Planta de biogás · Guaicaramo S.A.S</p>
      </div>
    </div>
  );
}
