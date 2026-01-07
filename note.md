Class Hash: 0x42d20d69ec294308319c5cac2ec66052e54b67701de2f75b1bd48fe8d864daf
Transaction Hash: 0x63ac5162eac219ea660ea66c44c669d39f991f802741b432ceb7a6d7595f501

To see declaration details, visit:
class: https://sepolia.starkscan.co/class/0x0200ed6f368eae0fa7a4636fa2c9e231a713d54f417a209f21d332a6b6da45c8
transaction: https://sepolia.starkscan.co/tx/0x063ac5162eac219ea660ea66c44c669d39f991f802741b432ceb7a6d7595f501

To deploy a contract of this class, replace the placeholders in `--arguments` with your actual values, then run:
sncast --account account420 deploy --class-hash 0x42d20d69ec294308319c5cac2ec66052e54b67701de2f75b1bd48fe8d864daf --arguments '<owner: ContractAddress>, <membership_verifier: ContractAddress>, <swap_verifier: ContractAddress>, <withdraw_verifier: ContractAddress>, <lp_verifier: ContractAddress>' --url https://api.cartridge.gg/x/starknet/sepolia

ryzen@xp:~/Desktop/dev/starknet-bounty/zylith$ sncast --account account420 deploy --url https://api.cartridge.gg/x/starknet/sepolia --class-hash 0x42d20d69ec294308319c5cac2ec66052e54b67701de2f75b1bd48fe8d864daf --arguments "0x066EE9d5F6791270d7cD1314
ddB9fc8f7EdCb59E2847e2b13D57A06e7c988D63,0x011c0deb3618f2358dcba0dda14f43ef47f40b7be681d6708f554ce3d0ad5432,0x04e7dc3190830a31c626
e88182630b1eb71f8f6c6f9562adb358697f4754093b,0x04ade28020ebb5676a8a55219bba7f4ef175ae8f8f8189491193b1153e991330,0x0202fa77f1158fce
60dbb3d62b503dba0ce9f360003507f459d21cbed52c87d6" --max-fee 150000000000000000
[WARNING] RPC node with the url https://api.cartridge.gg/x/starknet/sepolia uses incompatible version 0.9.0. Expected version: 0.10.0
Success: Deployment completed

Contract Address: 0x03a2134229b1938316f0db062a15c79a426df51805f57e8efcf306ef1e916aa6
Transaction Hash: 0x0527883f4079447251dc786def66a756a076d54e714a0068188cb54ab63b90bb

To see deployment details, visit:
contract: https://sepolia.starkscan.co/contract/0x03a2134229b1938316f0db062a15c79a426df51805f57e8efcf306ef1e916aa6
transaction: https://sepolia.starkscan.co/tx/0x0527883f4079447251dc786def66a756a076d54e714a0068188cb54ab63b90bb
