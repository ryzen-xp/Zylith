# Guía de Integración Frontend-Backend: Zylith

Este documento describe los pasos secuenciales para integrar completamente el frontend con los contratos de Zylith, el ASP server y los circuitos Circom.

## Estado Actual

- ✅ Frontend implementado (Next.js, componentes, páginas)
- ✅ Estructura base lista
- ⏳ Integración con contratos pendiente
- ⏳ Integración con ASP server pendiente
- ⏳ Integración con circuitos pendiente
- ⏳ Event listeners y sincronización pendiente

---

## Pasos de Integración

### FASE 1: Configuración y Preparación

#### TODO 1.1: Verificar Contratos Desplegados
**Objetivo**: Confirmar que todos los contratos están desplegados y accesibles

**Tareas**:
- [ ] Verificar que el contrato Zylith está desplegado en Sepolia
- [ ] Verificar que los 4 verifiers están desplegados
- [ ] Obtener los ABIs de los contratos
- [ ] Verificar direcciones en `frontend/src/lib/config.ts`

**Verificación**:
```bash
# Revisar CONTRACT_ADDRESS.md
cat zylith/CONTRACT_ADDRESS.md

# Verificar en Starkscan
# https://sepolia.starkscan.co/contract/[ADDRESS]
```

**Archivos a modificar**:
- `frontend/src/lib/config.ts` (si hay cambios en direcciones)

---

#### TODO 1.2: Obtener ABIs de Contratos
**Objetivo**: Extraer los ABIs necesarios para interactuar con los contratos

**Tareas**:
- [ ] Compilar contratos Cairo para obtener ABIs
- [ ] Crear archivo `frontend/src/lib/abis/zylith-abi.json`
- [ ] Crear archivo `frontend/src/lib/abis/erc20-abi.json`
- [ ] Crear archivo `frontend/src/lib/abis/verifiers-abi.json` (si es necesario)

**Comandos**:
```bash
cd zylith
scarb build
# Los ABIs deberían estar en target/dev/
```

**Archivos a crear**:
- `frontend/src/lib/abis/zylith-abi.json`
- `frontend/src/lib/abis/erc20-abi.json`
- `frontend/src/lib/abis/verifiers/` (carpeta con ABIs de verifiers)

---

#### TODO 1.3: Configurar Variables de Entorno
**Objetivo**: Asegurar que todas las variables de entorno estén configuradas

**Tareas**:
- [ ] Crear `.env.local` en `frontend/`
- [ ] Configurar `NEXT_PUBLIC_ZYLITH_CONTRACT`
- [ ] Configurar `NEXT_PUBLIC_ASP_URL`
- [ ] Configurar `NEXT_PUBLIC_RPC_URL`
- [ ] Configurar direcciones de verifiers (opcional, ya están en config.ts)

**Archivos a crear/modificar**:
- `frontend/.env.local` (crear desde `.env.example`)

---

### FASE 2: Integración con Contratos Cairo

#### TODO 2.1: Crear Cliente de Contrato Zylith
**Objetivo**: Implementar funciones para interactuar con el contrato Zylith

**Tareas**:
- [ ] Crear `frontend/src/lib/contracts/zylith-contract.ts`
- [ ] Implementar función `getZylithContract()` que retorne instancia del contrato
- [ ] Implementar helpers para llamadas comunes:
  - `initializePool()`
  - `getMerkleRoot()`
  - `isNullifierSpent()`
  - `isRootKnown()`

**Archivos a crear**:
- `frontend/src/lib/contracts/zylith-contract.ts`

**Dependencias**:
- ABI del contrato Zylith (TODO 1.2)

---

#### TODO 2.2: Integrar Private Deposit
**Objetivo**: Conectar el frontend con `private_deposit()` del contrato

**Tareas**:
- [ ] Crear hook `use-private-deposit.ts`
- [ ] Implementar flujo completo:
  1. Generar commitment (usar `generateCommitment`)
  2. Aprobar tokens ERC20
  3. Llamar `private_deposit()` en contrato
  4. Esperar transacción
  5. Obtener leaf index del evento
  6. Guardar note en portfolio store
- [ ] Agregar manejo de errores
- [ ] Agregar loading states

**Archivos a crear/modificar**:
- `frontend/src/hooks/use-private-deposit.ts`
- Actualizar `frontend/src/components/swap/SwapInterface.tsx` (si hay UI para deposit)

**Dependencias**:
- TODO 2.1 (cliente de contrato)

---

#### TODO 2.3: Integrar Private Swap
**Objetivo**: Conectar swap privado con el contrato

**Tareas**:
- [ ] Completar implementación en `use-private-swap.ts`
- [ ] Integrar con backend API para proof generation
- [ ] Implementar llamada a `private_swap()` del contrato
- [ ] Verificar que los public inputs del proof coincidan con la ejecución
- [ ] Manejar actualización de notes (input note → output note)
- [ ] Agregar manejo de errores específicos

**Archivos a modificar**:
- `frontend/src/hooks/use-private-swap.ts`
- `frontend/src/components/swap/SwapInterface.tsx`

**Dependencias**:
- TODO 2.1 (cliente de contrato)
- TODO 3.1 (backend API de proofs)

---

#### TODO 2.4: Integrar Private Withdraw
**Objetivo**: Conectar withdraw privado con el contrato

**Tareas**:
- [ ] Crear hook `use-private-withdraw.ts`
- [ ] Implementar flujo:
  1. Seleccionar note a retirar
  2. Generar proof de withdraw
  3. Llamar `private_withdraw()` en contrato
  4. Esperar transacción
  5. Remover note del portfolio store
- [ ] Agregar UI para withdraw (puede ser en portfolio page)

**Archivos a crear/modificar**:
- `frontend/src/hooks/use-private-withdraw.ts`
- `frontend/src/components/portfolio/NotesList.tsx` (agregar botón withdraw)

**Dependencias**:
- TODO 2.1 (cliente de contrato)
- TODO 3.1 (backend API de proofs)

---

#### TODO 2.5: Integrar Private Liquidity Operations
**Objetivo**: Conectar operaciones de liquidez con el contrato

**Tareas**:
- [ ] Completar `use-liquidity.ts`:
  - Integrar `private_mint_liquidity()`
  - Integrar `private_burn_liquidity()`
  - Integrar `private_collect()` (fees)
- [ ] Implementar llamadas al contrato
- [ ] Manejar actualización de posiciones
- [ ] Agregar manejo de errores

**Archivos a modificar**:
- `frontend/src/hooks/use-liquidity.ts`
- `frontend/src/components/liquidity/LiquidityManager.tsx`

**Dependencias**:
- TODO 2.1 (cliente de contrato)
- TODO 3.1 (backend API de proofs)

---

### FASE 3: Integración con Backend API

#### TODO 3.1: Configurar Backend API para Proof Generation
**Objetivo**: Asegurar que el backend puede generar proofs usando Circom

**Tareas**:
- [ ] Verificar que los circuitos están compilados en `circuits/out/`
- [ ] Verificar que los `.zkey` files existen
- [ ] Probar generación de proof manualmente:
  ```bash
  cd circuits
  node scripts/generate_proof.js swap [inputs]
  ```
- [ ] Verificar que `proof-service.ts` tiene los paths correctos
- [ ] Probar endpoint `/api/proof/swap` con datos de prueba

**Archivos a verificar**:
- `frontend/src/lib/proof-service.ts`
- `circuits/out/swap/swap.wasm`
- `circuits/out/swap/swap_final.zkey`

**Comandos de verificación**:
```bash
# Verificar que los circuitos están compilados
ls -la circuits/out/

# Probar proof generation manual
cd circuits
npm run generate:proof:swap
```

---

#### TODO 3.2: Implementar Formateo Correcto de Proofs para Garaga
**Objetivo**: Asegurar que los proofs están en el formato correcto para Garaga verifier

**Tareas**:
- [ ] Revisar formato esperado por Garaga verifier
- [ ] Verificar que `formatProofForGaraga()` en `proof-service.ts` es correcto
- [ ] Probar con un proof real y verificar en contrato
- [ ] Ajustar formato si es necesario

**Archivos a modificar**:
- `frontend/src/lib/proof-service.ts`

**Referencias**:
- Verificar formato en `zylith/src/privacy/verifiers/` (ver cómo Garaga espera los datos)

---

#### TODO 3.3: Integrar ASP Server
**Objetivo**: Conectar frontend con ASP server para obtener Merkle proofs

**⚠️ IMPORTANTE - Compatibilidad macOS:**
El ASP server no compila directamente en macOS debido a un problema con la dependencia `size-of`. Usa Docker para ejecutarlo.

**Tareas**:
- [ ] Iniciar ASP server usando Docker (ver `asp/README_DOCKER.md`)
- [ ] Verificar que ASP server está corriendo en `http://localhost:3001`
- [ ] Probar endpoints del ASP:
  - `GET /deposit/proof/:index`
  - `GET /deposit/root`
  - `GET /deposit/info`
  - `GET /health`
- [ ] Verificar que el proxy `/api/merkle/[...slug]` funciona
- [ ] Probar `use-asp.ts` hook con datos reales
- [ ] Agregar manejo de errores y retries

**Comandos de verificación**:
```bash
# Opción 1: Usar Docker (Recomendado para macOS)
cd asp
./docker-run.sh build
./docker-run.sh run

# Opción 2: Compilar directamente (solo funciona en Linux)
cd asp
cargo run

# Probar endpoints
curl http://localhost:3001/health
curl http://localhost:3001/deposit/root
```

**Archivos a verificar**:
- `frontend/src/lib/asp-client.ts`
- `frontend/src/hooks/use-asp.ts`
- `frontend/src/app/api/merkle/[...slug]/route.ts`
- `asp/Dockerfile` (para ejecutar en Docker)
- `asp/MACOS_COMPATIBILITY.md` (documentación del problema)

---

### FASE 4: Integración de UI con Funcionalidad

#### TODO 4.1: Conectar Swap Interface con Backend
**Objetivo**: Hacer que el swap interface funcione end-to-end

**Tareas**:
- [ ] Conectar `SwapInterface` con `use-private-swap`
- [ ] Implementar selección de note desde portfolio
- [ ] Agregar validaciones (balance suficiente, etc.)
- [ ] Mostrar progreso de proof generation
- [ ] Mostrar resultado de transacción
- [ ] Actualizar portfolio después del swap

**Archivos a modificar**:
- `frontend/src/components/swap/SwapInterface.tsx`
- `frontend/src/hooks/use-private-swap.ts`

**Dependencias**:
- TODO 2.3 (private swap integrado)
- TODO 3.1 (backend API funcionando)

---

#### TODO 4.2: Conectar Liquidity Manager con Backend
**Objetivo**: Hacer que las operaciones de liquidez funcionen

**Tareas**:
- [ ] Conectar `LiquidityManager` con `use-liquidity`
- [ ] Implementar cálculo de amounts basado en tick range
- [ ] Agregar validaciones
- [ ] Mostrar preview de posición antes de confirmar
- [ ] Actualizar lista de posiciones después de mint/burn

**Archivos a modificar**:
- `frontend/src/components/liquidity/LiquidityManager.tsx`
- `frontend/src/hooks/use-liquidity.ts`

**Dependencias**:
- TODO 2.5 (liquidity operations integradas)

---

#### TODO 4.3: Conectar Portfolio con Datos Reales
**Objetivo**: Mostrar datos reales del portfolio

**Tareas**:
- [ ] Conectar `BalanceDisplay` con portfolio store
- [ ] Conectar `NotesList` con notes del store
- [ ] Conectar `TransactionHistory` con transacciones reales
- [ ] Agregar funcionalidad de withdraw desde NotesList
- [ ] Agregar filtros y búsqueda

**Archivos a modificar**:
- `frontend/src/components/portfolio/BalanceDisplay.tsx`
- `frontend/src/components/portfolio/NotesList.tsx`
- `frontend/src/components/portfolio/TransactionHistory.tsx`

**Dependencias**:
- TODO 2.2 (private deposit)
- TODO 2.4 (private withdraw)

---

### FASE 5: Testing y Refinamiento

#### TODO 5.1: Testing End-to-End de Flujos Principales
**Objetivo**: Verificar que los flujos principales funcionan

**Tareas**:
- [ ] Test: Deposit → Swap → Withdraw
- [ ] Test: Deposit → Add Liquidity → Remove Liquidity
- [ ] Test: Multiple deposits y swaps
- [ ] Test: Error handling (insufficient balance, invalid proof, etc.)
- [ ] Test: Network switching (si aplica)

**Checklist de pruebas**:
- [ ] Puedo depositar tokens y ver el note en portfolio
- [ ] Puedo hacer un swap privado exitosamente
- [ ] Puedo retirar tokens privadamente
- [ ] Puedo agregar liquidez privadamente
- [ ] Puedo remover liquidez privadamente
- [ ] Los errores se muestran correctamente al usuario

---

#### TODO 5.2: Mejorar UX y Manejo de Errores
**Objetivo**: Refinar la experiencia de usuario

**Tareas**:
- [ ] Agregar mensajes de error user-friendly
- [ ] Agregar toasts para transacciones exitosas
- [ ] Mejorar loading states
- [ ] Agregar confirmaciones para acciones importantes
- [ ] Agregar tooltips explicativos
- [ ] Optimizar tiempos de proof generation (mostrar estimaciones)

**Archivos a modificar**:
- Todos los componentes de UI
- Agregar componente Toast si no existe

---

#### TODO 5.3: Optimización de Performance
**Objetivo**: Asegurar que la app es rápida y eficiente

**Tareas**:
- [ ] Optimizar re-renders innecesarios
- [ ] Implementar caching de Merkle proofs
- [ ] Lazy load componentes pesados
- [ ] Optimizar bundle size
- [ ] Agregar loading skeletons

**Verificación**:
```bash
npm run build
# Revisar bundle size y warnings
```

---

### FASE 6: Event Listeners y Sincronización en Tiempo Real

#### TODO 6.1: Implementar Event Listeners del Contrato
**Objetivo**: Escuchar eventos on-chain para actualizar el estado automáticamente

**Tareas**:
- [ ] Crear hook `use-contract-events.ts`
- [ ] Implementar listener para `PrivacyEvent::Deposit`:
  - Actualizar Merkle root cuando se detecte nuevo deposit
  - Actualizar portfolio store con nuevo note
- [ ] Implementar listener para `PoolEvent::Swap`:
  - Actualizar precio del pool
  - Actualizar liquidity si aplica
- [ ] Implementar listener para `PoolEvent::Mint/Burn`:
  - Actualizar posiciones de liquidez
- [ ] Implementar listener para `ProofRejected`:
  - Mostrar error al usuario cuando un proof sea rechazado
- [ ] Agregar cleanup de listeners al desmontar componentes

**Archivos a crear**:
- `frontend/src/hooks/use-contract-events.ts`

**Dependencias**:
- TODO 2.1 (cliente de contrato)

---

#### TODO 6.2: Sincronización de Estado Post-Transacción
**Objetivo**: Asegurar que el estado local se sincroniza después de cada transacción

**Tareas**:
- [ ] Después de `private_deposit`:
  - Obtener nuevo Merkle root del contrato
  - Obtener leaf index del evento
  - Actualizar note con index correcto
- [ ] Después de `private_swap`:
  - Obtener nuevo Merkle root
  - Remover input note del store
  - Agregar output note al store
  - Actualizar precio del pool
- [ ] Después de `private_withdraw`:
  - Obtener nuevo Merkle root
  - Remover note del store
- [ ] Después de `private_mint_liquidity`:
  - Obtener nuevo Merkle root
  - Actualizar/agregar posición en store
- [ ] Después de `private_burn_liquidity`:
  - Obtener nuevo Merkle root
  - Actualizar/remover posición
- [ ] Agregar polling o refresh manual como fallback

**Archivos a modificar**:
- Todos los hooks de operaciones privadas
- `frontend/src/hooks/use-portfolio.ts`

**Dependencias**:
- TODO 2.2, 2.3, 2.4, 2.5 (operaciones integradas)

---

#### TODO 6.3: Actualización de Estado del Pool en Tiempo Real
**Objetivo**: Mostrar información actualizada del pool (precio, liquidez, etc.)

**Tareas**:
- [ ] Crear hook `use-pool-state.ts`
- [ ] Implementar polling o subscription para:
  - Precio actual (`sqrt_price_x128`)
  - Liquidez total
  - Tick actual
  - Fee growth global
- [ ] Actualizar UI cuando cambie el precio
- [ ] Mostrar indicador de precio en swap interface
- [ ] Mostrar TVL (Total Value Locked) en dashboard

**Archivos a crear**:
- `frontend/src/hooks/use-pool-state.ts`

**Archivos a modificar**:
- `frontend/src/components/swap/SwapInterface.tsx`
- `frontend/src/app/page.tsx` (landing page metrics)

**Dependencias**:
- TODO 2.1 (cliente de contrato)

---

#### TODO 6.4: Manejo de Transacciones Revertidas
**Objetivo**: Detectar y manejar transacciones que fallan on-chain

**Tareas**:
- [ ] Implementar detección de transacciones revertidas
- [ ] Mostrar mensajes de error específicos:
  - Proof rechazado
  - Insufficient balance
  - Invalid Merkle root
  - Nullifier ya usado
- [ ] Revertir cambios locales si la transacción falla
- [ ] Permitir retry para ciertos errores
- [ ] Log errores para debugging

**Archivos a modificar**:
- Todos los hooks de operaciones
- `frontend/src/lib/starknet-client.ts`

**Dependencias**:
- TODO 2.2, 2.3, 2.4, 2.5 (operaciones integradas)

---

## Orden de Ejecución Recomendado

1. **FASE 1** (Configuración) - TODOs 1.1, 1.2, 1.3
2. **FASE 2** (Contratos) - TODOs 2.1, 2.2, 2.3, 2.4, 2.5
3. **FASE 3** (Backend) - TODOs 3.1, 3.2, 3.3
4. **FASE 4** (UI) - TODOs 4.1, 4.2, 4.3
5. **FASE 5** (Testing) - TODOs 5.1, 5.2, 5.3
6. **FASE 6** (Event Listeners) - TODOs 6.1, 6.2, 6.3, 6.4

## Notas Importantes

- **No avanzar al siguiente TODO hasta completar el anterior**
- **Verificar cada paso antes de continuar**
- **Documentar cualquier problema encontrado**
- **Actualizar este documento con notas y soluciones**

## Recursos

- Contratos: `zylith/CONTRACT_ADDRESS.md`
- Documentación: `docs/integration/frontend-integration-guide.md`
- ASP Server: `asp/src/main.rs`
- Circuitos: `circuits/`

---

**Última actualización**: [Fecha]
**Estado actual**: Pendiente de iniciar

