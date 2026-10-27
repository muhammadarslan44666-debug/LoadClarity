import React, { createContext, useContext, useState, useEffect } from 'react';

const CarrierContext = createContext();

export function CarrierProvider({ children }) {
  const [carrierId, setCarrierId] = useState(() => localStorage.getItem('lg_carrier') || 'all');
  useEffect(() => { localStorage.setItem('lg_carrier', carrierId); }, [carrierId]);
  return <CarrierContext.Provider value={{ carrierId, setCarrierId }}>{children}</CarrierContext.Provider>;
}

export const useCarrier = () => useContext(CarrierContext);