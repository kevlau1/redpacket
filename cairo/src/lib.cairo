use starknet::ContractAddress;

/// Must match `privacy::objects::OpenNoteDeposit` (positional Serde).
#[derive(Serde, Copy, Drop, PartialEq, Debug)]
pub struct OpenNoteDeposit {
    pub note_id: felt252,
    pub token: ContractAddress,
    pub amount: u128,
}

#[derive(Serde, Copy, Drop, PartialEq, Debug, starknet::Store)]
pub struct Pack {
    pub merkle_root: felt252,
    pub token: ContractAddress,
    pub remaining: u128,
    pub slots: u32,
    pub slots_left: u32,
    pub expiry: u64,
    pub refund_hash: felt252,
    pub random: bool,
    pub creator_hash: felt252,
}

#[derive(Serde, Copy, Drop, PartialEq, Debug)]
pub enum Op {
    Create,
    Claim,
    Refund,
}

pub const PASSWORD_TAG: felt252 = 'SEALPACK_PASS:V1';
pub const DROP_ID_TAG: felt252 = 'SEALPACK_DROP:V1';
pub const REFUND_TAG: felt252 = 'SEALPACK_REFUND:V1';
pub const CREATOR_TAG: felt252 = 'SEALPACK_CREATOR:V1';
pub const CLAIMED_TAG: felt252 = 'SEALPACK_CLAIMED:V1';
pub const USED_TAG: felt252 = 'SEALPACK_USED:V1';
pub const LEAF_TAG: felt252 = 'SEALPACK_LEAF:V1';
pub const COMMIT_TAG: felt252 = 'SEALPACK_COMMIT:V1';
pub const MAX_SLOTS: u32 = 50;

pub mod errors {
    pub const CALLER_NOT_PRIVACY: felt252 = 'CALLER_NOT_PRIVACY';
    pub const ZERO_POOL: felt252 = 'ZERO_POOL';
    pub const ZERO_TOKEN: felt252 = 'ZERO_TOKEN';
    pub const ZERO_AMOUNT: felt252 = 'ZERO_AMOUNT';
    pub const ZERO_PASSWORD: felt252 = 'ZERO_PASSWORD';
    pub const ZERO_REFUND_HASH: felt252 = 'ZERO_REFUND_HASH';
    pub const DROP_EXISTS: felt252 = 'DROP_EXISTS';
    pub const DROP_NOT_FOUND: felt252 = 'DROP_NOT_FOUND';
    pub const DROP_ID_MISMATCH: felt252 = 'DROP_ID_MISMATCH';
    pub const ALREADY_CLAIMED: felt252 = 'ALREADY_CLAIMED';
    pub const BAD_PASSWORD: felt252 = 'BAD_PASSWORD';
    pub const NO_SLOTS: felt252 = 'NO_SLOTS';
    pub const INSUFFICIENT_REMAINING: felt252 = 'INSUFFICIENT_REMAINING';
    pub const INSUFFICIENT_DEPOSIT: felt252 = 'INSUFFICIENT_DEPOSIT';
    pub const NOT_EXPIRED: felt252 = 'NOT_EXPIRED';
    pub const BAD_REFUND_SECRET: felt252 = 'BAD_REFUND_SECRET';
    pub const EXPIRY_IN_PAST: felt252 = 'EXPIRY_IN_PAST';
    pub const NOTHING_TO_REFUND: felt252 = 'NOTHING_TO_REFUND';
    pub const TOO_MANY_SLOTS: felt252 = 'TOO_MANY_SLOTS';
    pub const ZERO_SLOTS: felt252 = 'ZERO_SLOTS';
    pub const AMOUNT_TOO_SMALL: felt252 = 'AMOUNT_TOO_SMALL';
    pub const PACK_EXPIRED: felt252 = 'PACK_EXPIRED';
    pub const NOT_CREATOR: felt252 = 'NOT_CREATOR';
    pub const BAD_MERKLE: felt252 = 'BAD_MERKLE_PROOF';
    pub const BAD_PROOF_LEN: felt252 = 'BAD_PROOF_LEN';
    pub const LEAF_USED: felt252 = 'LEAF_ALREADY_USED';
    pub const ZERO_ROOT: felt252 = 'ZERO_MERKLE_ROOT';
}

#[starknet::interface]
pub trait IErc20<TState> {
    fn balance_of(self: @TState, account: ContractAddress) -> u256;
    fn approve(ref self: TState, spender: ContractAddress, amount: u256) -> bool;
}

pub fn password_hash(secret: felt252) -> felt252 {
    core::poseidon::poseidon_hash_span(array![PASSWORD_TAG, secret].span())
}

pub fn refund_hash(secret: felt252) -> felt252 {
    core::poseidon::poseidon_hash_span(array![REFUND_TAG, secret].span())
}

pub fn creator_hash(account: ContractAddress) -> felt252 {
    core::poseidon::poseidon_hash_span(array![CREATOR_TAG, account.into()].span())
}

pub fn claimed_key(drop_id: felt252, account: ContractAddress) -> felt252 {
    core::poseidon::poseidon_hash_span(array![CLAIMED_TAG, drop_id, account.into()].span())
}

pub fn leaf_used_key(drop_id: felt252, leaf: felt252) -> felt252 {
    core::poseidon::poseidon_hash_span(array![USED_TAG, drop_id, leaf].span())
}

pub fn claim_leaf(preimage: felt252, index: felt252) -> felt252 {
    core::poseidon::poseidon_hash_span(array![LEAF_TAG, preimage, index].span())
}

pub fn commit_leaf(ticket: felt252) -> felt252 {
    core::poseidon::poseidon_hash_span(array![COMMIT_TAG, ticket].span())
}

pub fn merkle_height(slots: u32) -> u32 {
    let mut n: u32 = 1;
    while n < slots {
        n *= 2;
    }
    let mut h: u32 = 0;
    let mut x = n;
    while x > 1 {
        x /= 2;
        h += 1;
    }
    h
}

pub fn hash_pair(a: felt252, b: felt252) -> felt252 {
    let au: u256 = a.into();
    let bu: u256 = b.into();
    if au < bu {
        core::poseidon::poseidon_hash_span(array![a, b].span())
    } else {
        core::poseidon::poseidon_hash_span(array![b, a].span())
    }
}

pub fn merkle_verify(leaf: felt252, proof: Span<felt252>, root: felt252) -> bool {
    let mut computed = leaf;
    let mut i = 0_usize;
    while i < proof.len() {
        computed = hash_pair(computed, *proof.at(i));
        i += 1;
    }
    computed == root
}

pub fn compute_drop_id(
    merkle_root: felt252,
    refund_commitment: felt252,
    token: ContractAddress,
    amount: u128,
    slots: u32,
    expiry: u64,
    random: bool,
) -> felt252 {
    let random_flag: felt252 = if random {
        1
    } else {
        0
    };
    core::poseidon::poseidon_hash_span(
        array![
            DROP_ID_TAG,
            merkle_root,
            refund_commitment,
            token.into(),
            amount.into(),
            slots.into(),
            expiry.into(),
            random_flag,
        ]
            .span(),
    )
}

pub fn next_payout(
    drop_id: felt252,
    remaining: u128,
    slots: u32,
    random: bool,
    timestamp: u64,
    claimer: ContractAddress,
    note_id: felt252,
) -> u128 {
    if slots == 1 {
        return remaining;
    }
    let slots_u: u128 = slots.into();
    if !random {
        return remaining / slots_u;
    }
    let reserved = slots_u - 1;
    let max_take = remaining - reserved;
    let avg = remaining / slots_u;
    let cap = avg * 2;
    let hi = if cap < max_take {
        cap
    } else {
        max_take
    };
    let lo: u128 = 1;
    if hi <= lo {
        return lo;
    }
    let span: u128 = hi - lo + 1;
    let seed = core::poseidon::poseidon_hash_span(
        array![
            drop_id, slots.into(), remaining.into(), timestamp.into(), claimer.into(), note_id,
        ]
            .span(),
    );
    let seed_u256: u256 = seed.into();
    let span_u256: u256 = span.into();
    let offset: u128 = (seed_u256 % span_u256).try_into().unwrap();
    lo + offset
}

#[starknet::interface]
pub trait ISealpack<TState> {
    fn privacy_invoke(
        ref self: TState,
        operation: Op,
        drop_id: felt252,
        token: ContractAddress,
        amount: u128,
        slots: u32,
        expiry: u64,
        refund_commitment: felt252,
        secret: felt252,
        random: u8,
        note_id: felt252,
        merkle_proof: Span<felt252>,
    ) -> Span<OpenNoteDeposit>;

    fn get_pack(self: @TState, drop_id: felt252) -> Pack;
    fn is_claimed(self: @TState, ticket: felt252) -> bool;
    fn get_privacy_contract(self: @TState) -> ContractAddress;
    fn get_locked(self: @TState, token: ContractAddress) -> u128;
}

#[starknet::contract]
mod Sealpack {
    use core::num::traits::Zero;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{
        ContractAddress, get_block_timestamp, get_caller_address, get_contract_address, get_tx_info,
    };
    use super::{
        IErc20Dispatcher, IErc20DispatcherTrait, ISealpack, OpenNoteDeposit, Op, Pack,
        compute_drop_id, claimed_key, commit_leaf, creator_hash, errors, leaf_used_key,
        merkle_height, merkle_verify, next_payout, refund_hash, MAX_SLOTS,
    };

    #[storage]
    struct Storage {
        privacy_contract: ContractAddress,
        packs: Map<felt252, Pack>,
        claimed: Map<felt252, bool>,
        locked: Map<ContractAddress, u128>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Created: Created,
        Claimed: Claimed,
        Refunded: Refunded,
    }

    #[derive(Drop, starknet::Event)]
    struct Created {
        #[key]
        drop_id: felt252,
        token: ContractAddress,
        amount: u128,
        slots: u32,
        expiry: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct Claimed {
        #[key]
        drop_id: felt252,
        amount: u128,
        slots_left: u32,
    }

    #[derive(Drop, starknet::Event)]
    struct Refunded {
        #[key]
        drop_id: felt252,
        amount: u128,
    }

    #[constructor]
    fn constructor(ref self: ContractState, privacy_contract: ContractAddress) {
        assert(privacy_contract.is_non_zero(), errors::ZERO_POOL);
        self.privacy_contract.write(privacy_contract);
    }

    fn assert_pool(self: @ContractState) -> ContractAddress {
        let privacy = self.privacy_contract.read();
        assert(get_caller_address() == privacy, errors::CALLER_NOT_PRIVACY);
        privacy
    }

    fn credit_locked(ref self: ContractState, token: ContractAddress, amount: u128) {
        let locked = self.locked.read(token);
        let next = locked + amount;
        let bal: u256 = IErc20Dispatcher { contract_address: token }
            .balance_of(get_contract_address());
        assert(bal >= next.into(), errors::INSUFFICIENT_DEPOSIT);
        self.locked.write(token, next);
    }

    fn debit_and_approve(
        ref self: ContractState, privacy: ContractAddress, token: ContractAddress, amount: u128,
    ) {
        let locked = self.locked.read(token);
        assert(locked >= amount, errors::INSUFFICIENT_REMAINING);
        self.locked.write(token, locked - amount);
        IErc20Dispatcher { contract_address: token }.approve(privacy, amount.into());
    }

    #[abi(embed_v0)]
    impl SealpackImpl of ISealpack<ContractState> {
        fn get_pack(self: @ContractState, drop_id: felt252) -> Pack {
            self.packs.read(drop_id)
        }

        fn is_claimed(self: @ContractState, ticket: felt252) -> bool {
            self.claimed.read(ticket)
        }

        fn get_privacy_contract(self: @ContractState) -> ContractAddress {
            self.privacy_contract.read()
        }

        fn get_locked(self: @ContractState, token: ContractAddress) -> u128 {
            self.locked.read(token)
        }

        fn privacy_invoke(
            ref self: ContractState,
            operation: Op,
            drop_id: felt252,
            token: ContractAddress,
            amount: u128,
            slots: u32,
            expiry: u64,
            refund_commitment: felt252,
            secret: felt252,
            random: u8,
            note_id: felt252,
            merkle_proof: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            let privacy = assert_pool(@self);

            match operation {
                Op::Create => {
                    assert(token.is_non_zero(), errors::ZERO_TOKEN);
                    assert(amount.is_non_zero(), errors::ZERO_AMOUNT);
                    assert(slots.is_non_zero(), errors::ZERO_SLOTS);
                    assert(slots <= MAX_SLOTS, errors::TOO_MANY_SLOTS);
                    assert(amount >= slots.into(), errors::AMOUNT_TOO_SMALL);
                    assert(secret.is_non_zero(), errors::ZERO_ROOT);
                    assert(refund_commitment.is_non_zero(), errors::ZERO_REFUND_HASH);
                    assert(expiry > get_block_timestamp(), errors::EXPIRY_IN_PAST);

                    // `secret` on Create is the Merkle root of committed tickets
                    // L_i = poseidon(SEALPACK_COMMIT:V1, poseidon(SEALPACK_LEAF:V1, pw, i)).
                    // Claim submits ticket T, never the password; proof siblings are L_i.
                    let merkle_root = secret;
                    let is_random = random != 0;
                    let expected_id = compute_drop_id(
                        merkle_root, refund_commitment, token, amount, slots, expiry, is_random,
                    );
                    assert(drop_id == expected_id, errors::DROP_ID_MISMATCH);
                    assert(self.packs.read(drop_id).merkle_root.is_zero(), errors::DROP_EXISTS);

                    credit_locked(ref self, token, amount);
                    let creator = get_tx_info().unbox().account_contract_address;
                    self
                        .packs
                        .write(
                            drop_id,
                            Pack {
                                merkle_root,
                                token,
                                remaining: amount,
                                slots,
                                slots_left: slots,
                                expiry,
                                refund_hash: refund_commitment,
                                random: is_random,
                                creator_hash: creator_hash(creator),
                            },
                        );
                    self.emit(Created { drop_id, token, amount, slots, expiry });
                    array![].span()
                },
                Op::Claim => {
                    assert(secret.is_non_zero(), errors::ZERO_PASSWORD);
                    let pack = self.packs.read(drop_id);
                    assert(pack.merkle_root.is_non_zero(), errors::DROP_NOT_FOUND);
                    assert(pack.slots_left.is_non_zero(), errors::NO_SLOTS);
                    assert(get_block_timestamp() < pack.expiry, errors::PACK_EXPIRED);
                    let height: u32 = merkle_height(pack.slots);
                    assert(merkle_proof.len() == height.into(), errors::BAD_PROOF_LEN);
                    let committed = commit_leaf(secret);
                    assert(merkle_verify(committed, merkle_proof, pack.merkle_root), errors::BAD_MERKLE);

                    let claimer = get_tx_info().unbox().account_contract_address;
                    let ticket = claimed_key(drop_id, claimer);
                    assert(!self.claimed.read(ticket), errors::ALREADY_CLAIMED);
                    let used = leaf_used_key(drop_id, secret);
                    assert(!self.claimed.read(used), errors::LEAF_USED);

                    let payout = next_payout(
                        drop_id,
                        pack.remaining,
                        pack.slots_left,
                        pack.random,
                        get_block_timestamp(),
                        claimer,
                        note_id,
                    );
                    assert(payout.is_non_zero(), errors::ZERO_AMOUNT);
                    assert(pack.remaining >= payout, errors::INSUFFICIENT_REMAINING);

                    self.claimed.write(ticket, true);
                    self.claimed.write(used, true);
                    let slots_left = pack.slots_left - 1;
                    self
                        .packs
                        .write(
                            drop_id,
                            Pack {
                                remaining: pack.remaining - payout, slots_left, ..pack,
                            },
                        );
                    debit_and_approve(ref self, privacy, pack.token, payout);
                    self.emit(Claimed { drop_id, amount: payout, slots_left });
                    array![OpenNoteDeposit { note_id, token: pack.token, amount: payout }].span()
                },
                Op::Refund => {
                    let pack = self.packs.read(drop_id);
                    assert(pack.merkle_root.is_non_zero(), errors::DROP_NOT_FOUND);
                    assert(pack.remaining.is_non_zero(), errors::NOTHING_TO_REFUND);
                    assert(get_block_timestamp() >= pack.expiry, errors::NOT_EXPIRED);
                    let who = get_tx_info().unbox().account_contract_address;
                    assert(creator_hash(who) == pack.creator_hash, errors::NOT_CREATOR);
                    assert(refund_hash(secret) == pack.refund_hash, errors::BAD_REFUND_SECRET);

                    let leftover = pack.remaining;
                    self
                        .packs
                        .write(drop_id, Pack { remaining: 0, slots_left: 0, ..pack });
                    debit_and_approve(ref self, privacy, pack.token, leftover);
                    self.emit(Refunded { drop_id, amount: leftover });
                    array![OpenNoteDeposit { note_id, token: pack.token, amount: leftover }].span()
                },
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use starknet::contract_address_const;
    use super::{
        claim_leaf, commit_leaf, creator_hash, hash_pair, merkle_height, merkle_verify, next_payout,
        password_hash, refund_hash,
    };

    fn nobody() -> starknet::ContractAddress {
        contract_address_const::<0>()
    }

    #[test]
    fn equal_split_last_takes_rest_shape() {
        let p = next_payout(1, 100_u128, 4, false, 0, nobody(), 0);
        assert!(p == 25_u128);
        let last = next_payout(1, 25_u128, 1, false, 0, nobody(), 0);
        assert!(last == 25_u128);
    }

    #[test]
    fn random_split_stays_in_range() {
        let p = next_payout(9, 100_u128, 4, true, 1, nobody(), 0);
        assert!(p >= 1_u128);
        assert!(p <= 50_u128);
    }

    #[test]
    fn random_split_depends_on_claimer() {
        let a = next_payout(9, 100_u128, 4, true, 1, contract_address_const::<1>(), 0);
        let b = next_payout(9, 100_u128, 4, true, 1, contract_address_const::<2>(), 0);
        assert!(a != b);
    }

    #[test]
    fn password_domain_separated() {
        assert!(password_hash(7) != refund_hash(7));
        assert!(password_hash(7) != creator_hash(contract_address_const::<7>()));
    }

    #[test]
    fn password_hash_matches_js_vector() {
        // src/lib/crypto.check.ts: poseidon(PASSWORD_TAG, 7)
        assert!(
            password_hash(7)
                == 0x6989971fba648844c46ddcc0daa05321991cd64b70554e6dd5d5dc8f84b81c1,
        );
    }

    #[test]
    fn hash_pair_matches_js_vector() {
        // hashPair(1, 2) sorted Poseidon
        assert!(
            hash_pair(1, 2)
                == 0x371cb6995ea5e7effcd2e174de264b5b407027a75a231a70c2c8d196107f0e7,
        );
        assert!(hash_pair(1, 2) == hash_pair(2, 1));
    }

    #[test]
    fn merkle_verify_two_leaves() {
        let root = hash_pair(1, 2);
        let proof = array![2].span();
        assert!(merkle_verify(1, proof, root));
        assert!(!merkle_verify(3, proof, root));
    }

    #[test]
    fn merkle_height_matches_padded_tree() {
        assert!(merkle_height(1) == 0);
        assert!(merkle_height(2) == 1);
        assert!(merkle_height(3) == 2);
        assert!(merkle_height(4) == 2);
        assert!(merkle_height(50) == 6);
    }

    #[test]
    fn committed_ticket_padded_tree() {
        let t0 = claim_leaf(7, 0);
        let t1 = claim_leaf(7, 1);
        let t2 = claim_leaf(7, 2);
        let l0 = commit_leaf(t0);
        let l1 = commit_leaf(t1);
        let l2 = commit_leaf(t2);
        let l3: felt252 = 0;
        let n1 = hash_pair(l0, l1);
        let n2 = hash_pair(l2, l3);
        let root = hash_pair(n1, n2);
        let proof = array![l1, n2].span();
        assert!(merkle_verify(commit_leaf(t0), proof, root));
        assert!(!merkle_verify(t0, proof, root));
        assert!(merkle_height(3) == 2);
        assert!(proof.len() == 2);
    }
}
