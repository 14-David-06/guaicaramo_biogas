'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { airtableService, MedicionBiodigestores, Biodigestor } from '@/utils/airtable';

export default function RegistroBiodigestoresPage() {
  const { user: loggedInUser, logout } = useAuth();

  // Estados del formulario
  const [ch4, setCh4] = useState<string>('');
  const [co2, setCo2] = useState<string>('');
  const [o2, setO2] = useState<string>('');
  const [h2s, setH2s] = useState<string>('');
  const [co, setCo] = useState<string>('');
  const [no, setNo] = useState<string>('');
  const [biodigestorSeleccionado, setBiodigestorSeleccionado] = useState<string>('');
  const [enviandoFormulario, setEnviandoFormulario] = useState(false);

  // Estados para datos
  const [biodigestores, setBiodigestores] = useState<Biodigestor[]>([]);
  const [mediciones, setMediciones] = useState<MedicionBiodigestores[]>([]);
  const [cargandoBiodigestores, setCargandoBiodigestores] = useState(true);
  const [cargandoMediciones, setCargandoMediciones] = useState(true);
  const [mostrarMediciones, setMostrarMediciones] = useState(false);

  // Cargar datos al montar el componente
  useEffect(() => {
    if (loggedInUser) {
      cargarBiodigestores();
      cargarMediciones();
      // Debug: explorar tabla desconocida
      airtableService.explorarTablaDesconocida();
    }
  }, [loggedInUser]);

  const cargarBiodigestores = async () => {
    setCargandoBiodigestores(true);
    try {
      const biodigestoresData = await airtableService.obtenerBiodigestores();
      setBiodigestores(biodigestoresData);
    } catch (error) {
      console.error('Error cargando biodigestores:', error);
    } finally {
      setCargandoBiodigestores(false);
    }
  };

  const cargarMediciones = async () => {
    setCargandoMediciones(true);
    try {
      const medicionesData = await airtableService.obtenerMedicionesBiodigestores();
      setMediciones(medicionesData);
    } catch (error) {
      console.error('Error cargando mediciones:', error);
    } finally {
      setCargandoMediciones(false);
    }
  };

  if (!loggedInUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-center">
          <h1 className="text-2xl mb-4">Acceso Requerido</h1>
          <p>Debes iniciar sesión para acceder al registro de biodigestores.</p>
        </div>
      </div>
    );
  }

  // Manejar selección de biodigestor
  const handleBiodigestorChange = (biodigestorId: string) => {
    setBiodigestorSeleccionado(biodigestorId);
  };

  // Validar formulario
  const isFormValid = () => {
    return ch4.trim() !== '' && 
           co2.trim() !== '' && 
           o2.trim() !== '' && 
           h2s.trim() !== '' && 
           co.trim() !== '' && 
           no.trim() !== '' &&
           biodigestorSeleccionado.trim() !== '';
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      alert('Todos los campos de medición son obligatorios');
      return;
    }

    setEnviandoFormulario(true);

    try {
      await airtableService.crearMedicionBiodigestores(
        parseFloat(ch4),
        parseFloat(co2),
        parseFloat(o2),
        parseFloat(h2s),
        parseFloat(co),
        parseFloat(no),
        loggedInUser.nombre,
        biodigestorSeleccionado ? [biodigestorSeleccionado] : []
      );

      alert('✅ Medición de biodigestores registrada exitosamente');
      
      // Limpiar formulario
      setCh4('');
      setCo2('');
      setO2('');
      setH2s('');
      setCo('');
      setNo('');
      setBiodigestorSeleccionado('');
      
      // Recargar mediciones
      await cargarMediciones();

    } catch (error) {
      console.error('Error al registrar medición:', error);
      alert('❌ Error al registrar la medición. Intenta nuevamente.');
    } finally {
      setEnviandoFormulario(false);
    }
  };

  // Formatear fecha para mostrar
  const formatearFecha = (fechaISO: string) => {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Navbar 
        onLoginClick={() => {}} 
        loggedInUser={loggedInUser}
        onLogout={logout}
      />
      
      <main className="pt-16 px-4 sm:px-6 lg:px-8 flex-grow">
        <div className="max-w-6xl mx-auto py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">Registro de Medición de Biodigestores</h1>
            <p className="text-gray-300 text-lg">Registro de mediciones de gases en biodigestores</p>
          </div>

          {/* Formulario de Medición */}
          <form onSubmit={handleSubmit} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-8 border border-slate-600/30 mb-8">
            
            {/* Mediciones de Gases */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              
              {/* CH4 (Max) % */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  CH4 (Max) % *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ch4}
                  onChange={(e) => setCh4(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>

              {/* CO2 % */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  CO2 % *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={co2}
                  onChange={(e) => setCo2(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>

              {/* O2 % */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  O2 % *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={o2}
                  onChange={(e) => setO2(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>

              {/* H2S */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  H2S *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={h2s}
                  onChange={(e) => setH2s(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.0"
                  required
                />
              </div>

              {/* CO */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  CO *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={co}
                  onChange={(e) => setCo(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.0"
                  required
                />
              </div>

              {/* NO */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  NO *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={no}
                  onChange={(e) => setNo(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.0"
                  required
                />
              </div>
            </div>

            {/* Selección de Biodigestor */}
            <div className="mb-8">
              <label className="block text-lg font-medium text-white mb-4">
                Biodigestor Monitoreado *
              </label>
              {cargandoBiodigestores ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                  <span className="ml-3 text-gray-300">Cargando biodigestores...</span>
                </div>
              ) : biodigestores.length === 0 ? (
                <p className="text-gray-400">No hay biodigestores disponibles</p>
              ) : (
                <select
                  value={biodigestorSeleccionado}
                  onChange={(e) => handleBiodigestorChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleccionar biodigestor...</option>
                  {biodigestores.map((biodigestor) => (
                    <option key={biodigestor.id} value={biodigestor.id}>
                      {biodigestor.fields['Nombre Biodigestores'] || biodigestor.fields['ID'] || biodigestor.id}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Botón de Envío */}
            <button
              type="submit"
              disabled={enviandoFormulario || !isFormValid()}
              className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-300 transform ${
                enviandoFormulario || !isFormValid()
                  ? 'bg-gray-600 cursor-not-allowed text-gray-300'
                  : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white hover:scale-105'
              }`}
            >
              {enviandoFormulario ? '📝 Registrando medición...' : '📊 Registrar Medición'}
            </button>
          </form>

          {/* Botón para mostrar mediciones anteriores */}
          <div className="mb-6">
            <button
              onClick={() => setMostrarMediciones(!mostrarMediciones)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105"
            >
              {mostrarMediciones ? '📁 Ocultar Mediciones' : '📂 Ver Mediciones Anteriores'}
            </button>
          </div>

          {/* Lista de Mediciones Anteriores */}
          {mostrarMediciones && (
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-8 border border-slate-600/30">
              <h2 className="text-2xl font-bold text-white mb-6">Mediciones Anteriores</h2>
              
              {cargandoMediciones ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                  <span className="ml-3 text-gray-300">Cargando mediciones...</span>
                </div>
              ) : mediciones.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No hay mediciones anteriores</p>
              ) : (
                <div className="space-y-6">
                  {mediciones.map((medicion) => (
                    <div key={medicion.id} className="bg-gray-700/30 rounded-lg p-6 border border-gray-600/30">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-sm text-gray-400">
                            {formatearFecha(medicion.fields['Fecha Medicion'])}
                          </p>
                          <p className="text-sm text-green-400">
                            Operador: {medicion.fields['Realiza Registro']}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="bg-gray-600/30 p-3 rounded">
                          <p className="text-xs text-gray-400">CH4 (Max) %</p>
                          <p className="text-lg font-semibold text-blue-400">{medicion.fields['CH4 (Max) %']}</p>
                        </div>
                        <div className="bg-gray-600/30 p-3 rounded">
                          <p className="text-xs text-gray-400">CO2 %</p>
                          <p className="text-lg font-semibold text-green-400">{medicion.fields['CO2 %']}</p>
                        </div>
                        <div className="bg-gray-600/30 p-3 rounded">
                          <p className="text-xs text-gray-400">O2 %</p>
                          <p className="text-lg font-semibold text-yellow-400">{medicion.fields['02 %']}</p>
                        </div>
                        <div className="bg-gray-600/30 p-3 rounded">
                          <p className="text-xs text-gray-400">H2S</p>
                          <p className="text-lg font-semibold text-red-400">{medicion.fields['H2S']}</p>
                        </div>
                        <div className="bg-gray-600/30 p-3 rounded">
                          <p className="text-xs text-gray-400">CO</p>
                          <p className="text-lg font-semibold text-orange-400">{medicion.fields['CO']}</p>
                        </div>
                        <div className="bg-gray-600/30 p-3 rounded">
                          <p className="text-xs text-gray-400">NO</p>
                          <p className="text-lg font-semibold text-purple-400">{medicion.fields['NO']}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
