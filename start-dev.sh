#!/bin/bash

# Reintentar npm run dev si falla
while true; do
  echo "Iniciando servidor..."
  npm run dev
  EXIT_CODE=$?
  
  if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Servidor terminó correctamente"
    break
  else
    echo "⚠️ Servidor terminó con error (código $EXIT_CODE), reintentando en 5 segundos..."
    sleep 5
  fi
done
