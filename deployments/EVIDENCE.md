# On-chain evidence

Every row below is a real transaction, read straight from the chains by `npm run replay`, which anyone can run with no keys. Times are UTC block times. The delay on each update is measured from the scorer's decision on Reactive Network to the update landing on that chain.

## The first live agent (earlier contracts)

Owner wallet `0x9920e3e5796b44a2729d064c73179f35ba70a0cb`.

**Delivery from Reactive to each chain: median 3s over 4 update(s), slowest 6s**

| Time (UTC) | Network | What happened | Transaction |
|---|---|---|---|
| 11-22 03:17:17 | Reactive Lasna | Scorer decision #1: linked, limit $50.00 | [`0x86483c…ef18`](https://lasna.reactscan.net/tx/0x86483ce837cfaa0f0a1297043e4a12b34d169577588200468d8df3a1368fef18) |
| 11-22 03:17:18 | Base Sepolia | Account opened (0xa03a683E72180ad87ce6f45f7d6F7B99936841D4) | [`0x57e26b…f6f7`](https://sepolia.basescan.org/tx/0x57e26b266146b645a15d77f35ddf2f6111f8ba6f35efe553328cd90a0f40f6f7) |
| 11-22 03:17:19 | Base Sepolia | Update #1 applied: limit $50.00  (2s after the scorer's decision) | [`0x04fb4c…198a`](https://sepolia.basescan.org/tx/0x04fb4c93720c51fd8e24096c8e2b7ebb99ff7d06485c0977de892100851c198a) |
| 11-22 03:17:21 | Unichain Sepolia | Account opened (0x4Ca9848bFa77293c9FCe459884C22Ac96244099f) | [`0x263e73…649a`](https://sepolia.uniscan.xyz/tx/0x263e73374e3386f306f81cff5764bac5d4b663abbb4642655bf9d75322d9649a) |
| 11-22 03:17:23 | Unichain Sepolia | Update #1 applied: limit $50.00  (6s after the scorer's decision) | [`0xa9162a…2873`](https://sepolia.uniscan.xyz/tx/0xa9162ae095e25330d54ca13a2b64730b879511852b97f338a20ec9a2c9ac2873) |
| 11-22 05:20:59 | Base Sepolia | AI bought $12.50 of ETH at $1648.73, signed by the NEAR enclave and checked on-chain | [`0xaed102…d053`](https://sepolia.basescan.org/tx/0xaed1020b17fd2b6ceaa724e5cde3ab0829eba35020ad20a907c36f211003d053) |
| 11-22 05:31:45 | Reactive Lasna | Scorer judged trade #0: +0.17% (win), $1648.73 -> $1651.64 | [`0xad63c3…ecf2`](https://lasna.reactscan.net/tx/0xad63c3ed136f58bf31d65e952484f16f9e975dd8f047386a2b4398fe1539ecf2) |
| 11-22 06:11:32 | Base Sepolia | AI bought $9.37 of ETH at $1659.82, signed by the NEAR enclave and checked on-chain | [`0x54c679…3a76`](https://sepolia.basescan.org/tx/0x54c6792b561ac4c766feeb93fde67d4dd395a31c2eaf8d64cfc90cfe32673a76) |
| 11-22 06:11:32 | Unichain Sepolia | AI bought $12.50 of ETH at $1658.91, signed by the NEAR enclave and checked on-chain | [`0x019549…cb97`](https://sepolia.uniscan.xyz/tx/0x019549ea01a8dcd226b7de52eb2047692614742ac0f5a9c7cf50378b637fcb97) |
| 11-22 06:22:32 | Reactive Lasna | Scorer judged trade #1: -0.32% (loss), $1659.82 -> $1654.48 | [`0x707ead…bc17`](https://lasna.reactscan.net/tx/0x707eadea56c382d5ecf7716b962606c0b6f8758f71ef7b38389025e8b0bbbc17) |
| 11-22 06:22:32 | Reactive Lasna | Scorer decision #2: cut after a loss, limit $37.50 | [`0x707ead…bc17`](https://lasna.reactscan.net/tx/0x707eadea56c382d5ecf7716b962606c0b6f8758f71ef7b38389025e8b0bbbc17) |
| 11-22 06:22:32 | Reactive Lasna | Scorer judged trade #0: -0.26% (loss), $1658.91 -> $1654.48 | [`0x707ead…bc17`](https://lasna.reactscan.net/tx/0x707eadea56c382d5ecf7716b962606c0b6f8758f71ef7b38389025e8b0bbbc17) |
| 11-22 06:22:32 | Reactive Lasna | Scorer decision #3: cut after a loss, limit $28.13 | [`0x707ead…bc17`](https://lasna.reactscan.net/tx/0x707eadea56c382d5ecf7716b962606c0b6f8758f71ef7b38389025e8b0bbbc17) |
| 11-22 06:22:34 | Base Sepolia | Update #3 applied: limit $28.13  (2s after the scorer's decision) | [`0x3d12bc…68b9`](https://sepolia.basescan.org/tx/0x3d12bce561568e8c629c1f9bfabc18ce847db29dc011b572323d7ec8b48e68b9) |
| 11-22 06:22:35 | Unichain Sepolia | Update #3 applied: limit $28.13  (3s after the scorer's decision) | [`0x9f93ce…037b`](https://sepolia.uniscan.xyz/tx/0x9f93ce310c695d887ce6feb88f00a378d84613b6540378389f630b6d3015037b) |
| 11-22 08:37:58 | Base Sepolia | Account opened (0xDfcD99b5369635A1501eA96Edfb79BC9483E35e1) | [`0x17eff1…df07`](https://sepolia.basescan.org/tx/0x17eff1b14aaac5e634826506cb519513502c0db29312b8fc39355a9f8538df07) |
| 11-22 08:37:59 | Base Sepolia | Update #3 applied: limit $28.13 | [`0xeba89a…ca80`](https://sepolia.basescan.org/tx/0xeba89a46a7ed81c2a1df0caa8b12e3f6a3c32effce732055ccbf7509d69bca80) |
| 11-22 08:38:12 | Unichain Sepolia | Account opened (0xffC76ebAd44dB68a1900CCB11A7BFbe3E46A823D) | [`0x8bbe4d…9a78`](https://sepolia.uniscan.xyz/tx/0x8bbe4d45535dc1b88b347a2cdb32626d1e43f423569ad31350f579bedb389a78) |
| 11-22 08:38:14 | Unichain Sepolia | Update #3 applied: limit $28.13 | [`0x34d569…384e`](https://sepolia.uniscan.xyz/tx/0x34d56947ec7f67258fc1618fc0def180e35dee5a8e9337b43a1d6d6a6627384e) |

## The live agent (current contracts)

Owner wallet `0xe9ba6652f5da56d40f69093a87e030eb9bb6f39d`.

**Delivery from Reactive to each chain: median 6s over 2 update(s), slowest 6s**

| Time (UTC) | Network | What happened | Transaction |
|---|---|---|---|
| 11-22 09:22:33 | Reactive Lasna | Scorer decision #1: linked, limit $50.00 | [`0xb20adc…c404`](https://lasna.reactscan.net/tx/0xb20adc7d496cf57a8011566905ce71e6bcf2740701ebd1dc30113cdb52bac404) |
| 11-22 09:22:34 | Base Sepolia | Account opened (0x4438175cCbaE9c348e52a0FE1a43C8a3c7d2E1C7) | [`0xafb5bf…a236`](https://sepolia.basescan.org/tx/0xafb5bf0595a4f98355046876735293daf7038ee0c935f907583bceb62fa1a236) |
| 11-22 09:22:35 | Base Sepolia | Update #1 applied: limit $50.00  (2s after the scorer's decision) | [`0x711ee8…a700`](https://sepolia.basescan.org/tx/0x711ee89e793487bbdeb62035a0377f4b1afc5117c849e89a1bdee998d1d8a700) |
| 11-22 09:22:37 | Unichain Sepolia | Account opened (0x2E4EdF13EA34ef4e51B17923B99d2aF3cA820489) | [`0x175e33…44d9`](https://sepolia.uniscan.xyz/tx/0x175e333907cc2fd8e1726e73b4a5ee8cfbb4cb984d3e7f76d305a5745a9044d9) |
| 11-22 09:22:39 | Unichain Sepolia | Update #1 applied: limit $50.00  (6s after the scorer's decision) | [`0x619bd9…9272`](https://sepolia.uniscan.xyz/tx/0x619bd9978adc620ec7f7e468e32a18ec2a961182ea8df9df98ce0aef64929272) |
| 11-22 09:51:48 | Base Sepolia | AI bought $12.50 of ETH at $1706.33, signed by the NEAR enclave and checked on-chain | [`0x3152ce…c32b`](https://sepolia.basescan.org/tx/0x3152ce71b24bb49824de7419b04b5fb60c8ab67b720e4ebd345cf9c62a06c32b) |
| 11-22 09:51:49 | Unichain Sepolia | AI bought $12.50 of ETH at $1703.24, signed by the NEAR enclave and checked on-chain | [`0xfcdee4…b6ae`](https://sepolia.uniscan.xyz/tx/0xfcdee48eebe5c5bf30bb2bc2b13037ae053350be02f32f3d54cf539a1a74b6ae) |
| 11-22 09:59:10 | Base Sepolia | AI bought $9.37 of ETH at $1718.97, signed by the NEAR enclave and checked on-chain | [`0xc39ecc…3f62`](https://sepolia.basescan.org/tx/0xc39ecc78abe0a20660d6e4e48afec885809f0689028e594367f81ded83ee3f62) |
| 11-22 09:59:10 | Unichain Sepolia | AI bought $9.37 of ETH at $1713.89, signed by the NEAR enclave and checked on-chain | [`0xe25f9c…ad15`](https://sepolia.uniscan.xyz/tx/0xe25f9cdf42d79102c9921f54b13ae00fd46a39b32d0312284621d6bb6fc6ad15) |

Regenerate this from the chains at any time:

```bash
npm run replay
```
