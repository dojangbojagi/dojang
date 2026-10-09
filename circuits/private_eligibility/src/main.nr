fn main(
    subject: pub Field,
    commitment: pub Field,
    policy_id: pub Field,
    policy_version: pub Field,
    threshold: pub Field,
    credential_version: pub Field,
    expires_at: pub Field,
    chain_id: pub Field,
    vault_address: pub Field,
    private_value: u64,
    salt: Field,
) {
    let domain_tag: Field = 0x1f474957415f505249564154455f454c49474942494c4954595f5631;
    let threshold_u64 = threshold as u64;
    assert((threshold_u64 as Field) == threshold);
    assert(private_value >= threshold_u64);

    let expected_commitment = std::hash::pedersen_hash([
        domain_tag,
        private_value as Field,
        salt,
        subject,
        policy_id,
        policy_version,
        threshold,
        credential_version,
        expires_at,
        chain_id,
        vault_address,
    ]);

    assert(expected_commitment == commitment);
}
