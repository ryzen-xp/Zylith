ryzen@xp:~/Desktop/dev/starknet-bounty/zylith$ sncast --profile sepolia  declare --url https://api.cartridge.gg/x/starknet/sepolia  --contract-name Zylith
[WARNING] RPC node with the url https://api.cartridge.gg/x/starknet/sepolia uses incompatible version 0.9.0. Expected version: 0.10.0
   Compiling zylith v0.1.0 (/home/ryzen/Desktop/dev/starknet-bounty/zylith/Scarb.toml)
    Finished `sepolia` profile target(s) in 5 seconds
Success: Declaration completed

Class Hash:       0x5d8aa79ef45cbd051fc26f9e7ea3df89ce6b1a18a641b92a755c9f788e7242d
Transaction Hash: 0x1433c9e6632765a04cf24b3e9cc8eda0d6190545f5f3026f14dbce76a8a2da0

To see declaration details, visit:
class: https://sepolia.starkscan.co/class/0x05d8aa79ef45cbd051fc26f9e7ea3df89ce6b1a18a641b92a755c9f788e7242d
transaction: https://sepolia.starkscan.co/tx/0x01433c9e6632765a04cf24b3e9cc8eda0d6190545f5f3026f14dbce76a8a2da0

To deploy a contract of this class, replace the placeholders in `--arguments` with your actual values, then run:
sncast --account account420 deploy --class-hash 0x5d8aa79ef45cbd051fc26f9e7ea3df89ce6b1a18a641b92a755c9f788e7242d --arguments '<owner: ContractAddress>, <membership_verifier: ContractAddress>, <swap_verifier: ContractAddress>, <withdraw_verifier: ContractAddress>, <lp_verifier: ContractAddress>' --url https://api.cartridge.gg/x/starknet/sepolia

ryzen@xp:~/Desktop/dev/starknet-bounty/zylith$ sncast   --account account420   deploy   --url https://api.cartridge.gg/x/starknet/sepolia   --class-hash 0x5d8aa79ef45cbd051fc26f9e7ea3df89ce6b1a18a641b92a755c9f788e7242d   --arguments "0x066EE9d5F6791270d7cD1314ddB9fc8f7EdCb59E2847e2b13D57A06e7c988D63,0x011c0deb3618f2358dcba0dda14f43ef47f40b7be681d6708f554ce3d0ad5432,0x04e7dc3190830a31c626e88182630b1eb71f8f6c6f9562adb358697f4754093b,0x04ade28020ebb5676a8a55219bba7f4ef175ae8f8f8189491193b1153e991330,0x0202fa77f1158fce60dbb3d62b503dba0ce9f360003507f459d21cbed52c87d6"   --max-fee 150000000000000000
[WARNING] RPC node with the url https://api.cartridge.gg/x/starknet/sepolia uses incompatible version 0.9.0. Expected version: 0.10.0
Success: Deployment completed

Contract Address: 0x04be88b8ded4bcb9bef0d7afce05c8eff7df67714a2e6a9371ed1151948a3dc3
Transaction Hash: 0x01c58a2ee9f7920fd65ef2d9c461355ee7a84512dab6050deac0b80d58f071ce

To see deployment details, visit:
contract: https://sepolia.starkscan.co/contract/0x04be88b8ded4bcb9bef0d7afce05c8eff7df67714a2e6a9371ed1151948a3dc3
transaction: https://sepolia.starkscan.co/tx/0x01c58a2ee9f7920fd65ef2d9c461355ee7a84512dab6050deac0b80d58f071ce

