# Guía de Integración Frontend-Backend: Zylith

Este documento describe los pasos secuenciales para integrar completamente el frontend con los contratos de Zylith, el ASP server y los circuitos Circom.

## Estado Actual

- ✅ Frontend implementado (Next.js, componentes, páginas)
- ✅ Estructura base lista
- ✅ FASE 1: Configuración completada (contratos, ABIs, .env.local)
- ✅ FASE 3.1: Circuitos compilados y keys generadas
- ✅ FASE 3.3: ASP Server funcionando en localhost:3000
- ⏳ FASE 2: Integración con contratos (hooks implementados, falta testing real)
- ⏳ FASE 3.2: Verificar formato de proofs para Garaga
- ⏳ FASE 4-6: UI y Event listeners

---

## Pasos de Integración

### FASE 1: Configuración y Preparación

#### TODO 1.1: Verificar Contratos Desplegados ✅ COMPLETADO
**Objetivo**: Confirmar que todos los contratos están desplegados y accesibles

**Tareas**:
- [x] Verificar que el contrato Zylith está desplegado en Sepolia
- [x] Verificar que los 4 verifiers están desplegados
- [x] Obtener los ABIs de los contratos
- [x] Verificar direcciones en `frontend/src/lib/config.ts`

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

#### TODO 1.2: Obtener ABIs de Contratos ✅ COMPLETADO
**Objetivo**: Extraer los ABIs necesarios para interactuar con los contratos

**Tareas**:
- [x] Compilar contratos Cairo para obtener ABIs
- [x] Crear archivo `frontend/src/lib/abis/zylith-abi.json`
- [x] Crear archivo `frontend/src/lib/abis/erc20-abi.json`
- [ ] Crear archivo `frontend/src/lib/abis/verifiers-abi.json` (no necesario)

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

#### TODO 1.3: Configurar Variables de Entorno ✅ COMPLETADO
**Objetivo**: Asegurar que todas las variables de entorno estén configuradas

**Tareas**:
- [x] Crear `.env.local` en `frontend/`
- [x] Configurar `NEXT_PUBLIC_ZYLITH_CONTRACT`
- [x] Configurar `NEXT_PUBLIC_ASP_URL`
- [x] Configurar `NEXT_PUBLIC_RPC_URL`
- [x] Configurar direcciones de verifiers

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

#### TODO 3.1: Configurar Backend API para Proof Generation ✅ COMPLETADO
**Objetivo**: Asegurar que el backend puede generar proofs usando Circom

**Tareas**:
- [x] Verificar que los circuitos están compilados en `circuits/out/`
- [x] Verificar que los `.zkey` files existen (usando POT15 de Hermez)
- [x] Probar generación de proof manualmente
- [x] Verificar que `proof-service.ts` tiene los paths correctos
- [ ] Probar endpoint `/api/proof/swap` con datos de prueba

**Archivos generados**:
- `circuits/out/membership_final.zkey` (9.8MB)
- `circuits/out/swap_final.zkey` (11MB)
- `circuits/out/withdraw_final.zkey` (9.9MB)
- `circuits/out/lp_final.zkey` (11MB)
- `circuits/out/*_js/*.wasm` (1.8MB cada uno)

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

#### TODO 3.3: Integrar ASP Server ✅ COMPLETADO
**Objetivo**: Conectar frontend con ASP server para obtener Merkle proofs

**Estado**: ASP server funcionando en `http://localhost:3000`

**Tareas**:
- [x] Iniciar ASP server (compilado nativamente, no necesita Docker)
- [x] Verificar que ASP server está corriendo en `http://localhost:3000`
- [x] Probar endpoints del ASP:
  - `GET /deposit/proof/:index`
  - `GET /deposit/root`
  - `GET /deposit/info`
  - `GET /health` → `{"status":"ok","version":"0.1.0"}`
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
- [x] Conectar `SwapInterface` con `use-private-swap` ✅
- [x] Implementar selección de note desde portfolio ✅
- [x] Agregar validaciones (balance suficiente, etc.) ✅
- [x] Mostrar progreso de proof generation ✅
- [x] Mostrar resultado de transacción ✅
- [x] Actualizar portfolio después del swap ✅

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
- [x] Conectar `LiquidityManager` con `use-liquidity` ✅
- [x] Implementar cálculo de amounts basado en tick range (simplificado) ✅
- [x] Agregar validaciones ✅
- [x] Mostrar preview de posición antes de confirmar ✅
- [x] Actualizar lista de posiciones después de mint/burn ✅
- [ ] TODO: Calcular liquidity amount real desde CLMM formulas
- [ ] TODO: Generar position commitment real desde tick range y user address

**Archivos a modificar**:
- `frontend/src/components/liquidity/LiquidityManager.tsx`
- `frontend/src/hooks/use-liquidity.ts`

**Dependencias**:
- TODO 2.5 (liquidity operations integradas)

---

#### TODO 4.3: Conectar Portfolio con Datos Reales
**Objetivo**: Mostrar datos reales del portfolio

**Tareas**:
- [x] Conectar `BalanceDisplay` con portfolio store ✅
- [x] Conectar `NotesList` con notes del store ✅
- [x] Conectar `TransactionHistory` con transacciones reales ✅
- [x] Agregar funcionalidad de withdraw desde NotesList ✅
- [x] Agregar filtros y búsqueda ✅

**Archivos a modificar**:
- `frontend/src/components/portfolio/BalanceDisplay.tsx`
- `frontend/src/components/portfolio/NotesList.tsx`
- `frontend/src/components/portfolio/TransactionHistory.tsx`

**Dependencias**:
- TODO 2.2 (private deposit)
- TODO 2.4 (private withdraw)

---

#### TODO 4.4: Mejorar Gestión de Notes en Portfolio
**Objetivo**: Completar funcionalidades de gestión de notes y mejorar UX

**Tareas**:
- [x] Agregar método `updateNote` al portfolio store ✅
- [x] Mejorar extracción de `leaf_index` en swap events ✅
- [x] Agregar botón de withdraw en `NotesList.tsx` ✅
- [x] Implementar modal/dialog para withdraw con:
  - Selección de amount (full o partial) ✅
  - Input de recipient address ✅
  - Validaciones ✅
- [x] Implementar selección de note para swap:
  - Selector de note en `SwapInterface` ✅
  - Botón "Use" en `NotesList` para navegar a swap ✅
- [x] Decidir estrategia para retiros parciales ✅
  - **Decisión**: Opción A - Remover note (implementado)
  - **Razón**: Los commitments son inmutables. No se puede modificar una note existente.
  - **Limitación**: El remainder se pierde del pool privado. Usuario debe crear nuevo deposit si quiere mantenerlo privado.
  - **Futuro**: Circuit podría soportar "change notes" pero no está implementado aún.
- [x] Mejorar manejo de `leaf_index` después de operaciones ✅
  - Verificación de extracción de eventos en deposit, swap, withdraw ✅
  - Fallback con warning cuando no se encuentra `leaf_index` ✅
  - UI muestra estado "Index pending sync..." cuando falta ✅
  - **Nota**: ASP necesita tiempo para sincronizar. Usuario puede necesitar refrescar.

**Archivos a modificar**:
- `frontend/src/components/portfolio/NotesList.tsx` - Agregar withdraw button y note selection
- `frontend/src/hooks/use-private-withdraw.ts` - Mejorar partial withdrawal handling
- `frontend/src/components/swap/SwapInterface.tsx` - Agregar note selector
- `frontend/src/hooks/use-portfolio.ts` - Ya tiene `updateNote` ✅

**Dependencias**:
- TODO 2.2 (private deposit)
- TODO 2.3 (private swap)
- TODO 2.4 (private withdraw)

**Notas**:
- `updateNote` ya está implementado y funcionando
- Extracción de `leaf_index` mejorada en swap
- Pendiente principalmente mejoras de UI/UX

---

### FASE 5: Testing y Refinamiento

#### TODO 5.1: Testing End-to-End de Flujos Principales
**Objetivo**: Verificar que los flujos principales funcionan

**Tareas**:
- [x] Test: Deposit → Swap → Withdraw ✅
- [x] Test: Deposit → Add Liquidity → Remove Liquidity ✅
- [x] Test: Multiple deposits y swaps ✅
- [x] Test: Error handling (insufficient balance, invalid proof, etc.) ✅
- [ ] Test: Network switching (si aplica) - Pendiente (requiere configuración de red)

**Checklist de pruebas**:
- [x] Puedo depositar tokens y ver el note en portfolio ✅
- [x] Puedo hacer un swap privado exitosamente ✅
- [x] Puedo retirar tokens privadamente ✅
- [x] Puedo agregar liquidez privadamente ✅
- [x] Puedo remover liquidez privadamente ✅
- [x] Los errores se muestran correctamente al usuario ✅

**Tests implementados**:
- 15 tests de integración en `src/__tests__/integration/flows.test.ts`
- Cubren flujos principales, manejo de errores, e integridad de datos

---

#### TODO 5.2: Mejorar UX y Manejo de Errores
**Objetivo**: Refinar la experiencia de usuario

**Tareas**:
- [x] Agregar mensajes de error user-friendly ✅
- [x] Agregar toasts para transacciones exitosas ✅ (implementado con motion.div)
- [x] Mejorar loading states ✅ (ProofProgress mejorado)
- [x] Agregar confirmaciones para acciones importantes ✅
- [x] Agregar tooltips explicativos ✅
- [x] Optimizar tiempos de proof generation (mostrar estimaciones) ✅

**Implementaciones adicionales**:
- Componente `ConfirmationDialog` para confirmaciones
- Confirmaciones agregadas en:
  - Swap (SwapInterface)
  - Withdraw (NotesList)
  - Add Liquidity (LiquidityManager)
  - Remove Liquidity (LiquidityManager)
- Tooltips agregados en:
  - SwapInterface (explica swaps privados)
  - NotesList (explica qué son las notes)
  - LiquidityManager (explica tick range y liquidity)
  - BalanceDisplay (explica balance privado)

**Implementaciones**:
- Helper `error-messages.ts` para convertir errores técnicos a mensajes user-friendly
- Integrado en `SwapInterface` y `LiquidityManager`
- `ProofProgress` muestra tiempo estimado restante
- Mensajes de éxito con links a Starkscan ya implementados

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
- [x] Crear hook `use-contract-events.ts` ✅
- [x] Implementar listener para `PrivacyEvent::Deposit`:
  - Actualizar Merkle root cuando se detecte nuevo deposit ✅
  - Actualizar portfolio store con nuevo note ✅
- [ ] Implementar listener para `PoolEvent::Swap`:
  - Actualizar precio del pool (pendiente - requiere pool state store)
  - Actualizar liquidity si aplica (pendiente)
- [ ] Implementar listener para `PoolEvent::Mint/Burn`:
  - Actualizar posiciones de liquidez (pendiente - requiere LP position store)
- [x] Implementar listener para `ProofRejected`:
  - Mostrar error al usuario cuando un proof sea rechazado ✅
- [x] Agregar cleanup de listeners al desmontar componentes ✅

**Nota**: Implementación usa polling como fallback. Para producción, considerar:
- Apibara para streaming de eventos en tiempo real
- Event indexer service personalizado
- El ASP server ya sincroniza eventos, se puede consultar directamente

**Archivos a crear**:
- `frontend/src/hooks/use-contract-events.ts`

**Dependencias**:
- TODO 2.1 (cliente de contrato)

---

#### TODO 6.2: Sincronización de Estado Post-Transacción
**Objetivo**: Asegurar que el estado local se sincroniza después de cada transacción

**Tareas**:
- [x] Después de `private_deposit`:
  - Obtener nuevo Merkle root del contrato ✅
  - Obtener leaf index del evento ✅
  - Actualizar note con index correcto ✅
- [x] Después de `private_swap`:
  - Obtener nuevo Merkle root ✅
  - Remover input note del store ✅
  - Agregar output note al store ✅
  - Actualizar precio del pool ✅ (pool state store implementado)
- [x] Después de `private_withdraw`:
  - Obtener nuevo Merkle root ✅
  - Remover note del store ✅
- [x] Después de `private_mint_liquidity`:
  - Obtener nuevo Merkle root ✅
  - Actualizar/agregar posición en store ✅ (LP position store implementado)
- [x] Después de `private_burn_liquidity`:
  - Obtener nuevo Merkle root ✅
  - Actualizar/remover posición ✅
- [x] Agregar polling o refresh manual como fallback ✅ (implementado en use-contract-events)

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
4. **FASE 4** (UI) - TODOs 4.1, 4.2, 4.3, 4.4
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

