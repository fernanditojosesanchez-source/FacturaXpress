import { useMutation } from "@tanstack/react-query";

interface DTEValidationError {
  field: string;
  message: string;
}

interface ValidateDTEResponse {
  valid: boolean;
  message?: string;
  errors?: DTEValidationError[];
}

export function useValidateDTE() {
  return useMutation({
    mutationFn: async (dteData: any): Promise<ValidateDTEResponse> => {
      const response = await fetch("/api/validar-dte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(dteData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      return response.json();
    },
  });
}
