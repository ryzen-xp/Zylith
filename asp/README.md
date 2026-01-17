# Zylith ASP Server

Association Set Provider (ASP) server que mantiene una réplica off-chain del Merkle tree del contrato Zylith y genera Merkle paths para usuarios.

## 🚀 Inicio Rápido

### Opción 1: Usar el script de inicio

```bash
cd asp
./start.sh
```

### Opción 2: Manual

```bash
cd asp

# Configurar variables de entorno
export RPC_URL="https://api.cartridge.gg/x/starknet/sepolia"
export CONTRACT_ADDRESS="0x00c692a0a7b34ffe8c5484e6db9488dc881ceae9c9b05d67de21387ea9f3edd6"
export PORT="3000"

# Compilar (primera vez)
cargo build --release

# Ejecutar
cargo run --release
```

## 📋 Configuración

### Variables de Entorno

| Variable           | Descripción                   | Valor por Defecto       |
| ------------------ | ----------------------------- | ----------------------- |
| `RPC_URL`          | URL del RPC de Starknet       | `http://localhost:5050` |
| `CONTRACT_ADDRESS` | Dirección del contrato Zylith | -                       |
| `PORT`             | Puerto del servidor API       | `3000`                  |

### Valores para Sepolia

```bash
export RPC_URL="https://api.cartridge.gg/x/starknet/sepolia"
export CONTRACT_ADDRESS="0x00c692a0a7b34ffe8c5484e6db9488dc881ceae9c9b05d67de21387ea9f3edd6"
export PORT="3000"
```

## 🔌 API Endpoints

### Health Check

```bash
curl http://localhost:3000/health
```

**Respuesta:**

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

### Obtener Merkle Proof

```bash
curl http://localhost:3000/deposit/proof/0
```

**Respuesta:**

```json
{
  "leaf": "0x1234...",
  "path": ["0xabcd...", "0xef01..."],
  "path_indices": [0, 1, 0, ...],
  "root": "0x5678..."
}
```

### Obtener Root Actual

```bash
curl http://localhost:3000/deposit/root
```

**Respuesta:**

```json
"0x5678..."
```

### Información del Árbol

```bash
curl http://localhost:3000/deposit/info
```

**Respuesta:**

```json
{
  "root": "0x5678...",
  "leaf_count": 42,
  "depth": 25
}
```

## 🔄 Sincronización

El ASP server automáticamente:

1. **Escucha eventos** `Deposit` del contrato Zylith
2. **Inserta commitments** en el Merkle tree local
3. **Sincroniza cada 5 segundos** con la blockchain
4. **Guarda estado** en `asp_state.json` para recuperación

### Estado Persistente

El servidor guarda el último bloque sincronizado en `asp_state.json`:

```json
{
  "last_synced_block": 12345
}
```

Si reinicias el servidor, continuará desde el último bloque sincronizado.

## 🧪 Verificación

### Verificar que está corriendo

```bash
curl http://localhost:3000/health
```

### Verificar sincronización

```bash
# Ver cuántos depósitos ha procesado
curl http://localhost:3000/deposit/info

# Comparar root con on-chain
curl http://localhost:3000/deposit/root
# Debe coincidir con el root del contrato
```

### Ver logs del servidor

El servidor imprime logs en la consola:

```
Starting sync from block 12345
Syncing blocks 12346 to 12350
Synced deposit #0: commitment=0x..., root=0x...
Processed 1 deposit events
```

## 🛠️ Troubleshooting

### El servidor no inicia

**Problema:** Error de compilación

```bash
# Solución: Compilar primero
cargo build --release
```

### No sincroniza eventos

**Problema:** No detecta eventos Deposit

```bash
# Verificar:
# 1. RPC_URL es correcto
echo $RPC_URL

# 2. CONTRACT_ADDRESS es correcto
echo $CONTRACT_ADDRESS

# 3. El contrato está desplegado en esa red
# Verifica en Starkscan
```

### Root no coincide

**Problema:** Root del ASP no coincide con on-chain

```bash
# Solución: Resincronizar desde el inicio
# 1. Detener el servidor
# 2. Eliminar asp_state.json
rm asp_state.json

# 3. Reiniciar (sincronizará desde el bloque 0)
./start.sh
```

### Puerto ya en uso

**Problema:** Puerto 3000 ocupado

```bash
# Solución: Usar otro puerto
export PORT="3001"
./start.sh
```

## 📊 Monitoreo

### Ver estado actual

```bash
# Info del árbol
curl http://localhost:3000/deposit/info

# Root actual
curl http://localhost:3000/deposit/root
```

### Verificar sincronización

Compara el `leaf_count` del ASP con el número de eventos Deposit en el contrato (puedes verlo en Starkscan).

## 🔗 Integración con Frontend

```typescript
// Ejemplo de uso desde frontend
const ASP_URL = "http://localhost:3000";

// Obtener Merkle proof
async function getMerkleProof(leafIndex: number) {
  const response = await fetch(`${ASP_URL}/deposit/proof/${leafIndex}`);
  return response.json();
}

// Verificar root
async function getCurrentRoot() {
  const response = await fetch(`${ASP_URL}/deposit/root`);
  return response.text();
}
```

## 📝 Notas

- El servidor debe estar corriendo **antes** de hacer depósitos privados
- La sincronización es automática, pero puede tomar 5-10 segundos
- El estado se guarda automáticamente, puedes reiniciar sin perder datos
- El servidor usa Poseidon BN254 compatible con Circom

## 🚀 Producción

Para producción:

1. **Usar variables de entorno** en lugar de valores hardcodeados
2. **Configurar logging** apropiado (tracing)
3. **Usar base de datos** en lugar de archivo JSON para estado
4. **Implementar rate limiting** en la API
5. **Configurar CORS** apropiadamente
6. **Usar HTTPS** para la API

---

**Última actualización:** Enero 2025
