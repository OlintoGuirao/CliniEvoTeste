import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type CurrentPatientContextValue = {
  patientId: string | null;
  setPatientId: (id: string | null) => void;
};

const CurrentPatientContext = createContext<CurrentPatientContextValue | null>(null);

export function CurrentPatientProvider({ children }: { children: ReactNode }) {
  const [patientId, setPatientId] = useState<string | null>(null);
  const setPatientIdStable = useCallback((id: string | null) => setPatientId(id), []);
  return (
    <CurrentPatientContext.Provider value={{ patientId, setPatientId: setPatientIdStable }}>
      {children}
    </CurrentPatientContext.Provider>
  );
}

export function useCurrentPatient() {
  const ctx = useContext(CurrentPatientContext);
  return ctx ?? { patientId: null, setPatientId: () => {} };
}
