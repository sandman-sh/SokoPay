// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SokoAgentOracle
 * @author SokoPay Protocol
 * @notice Trustless on-chain verification oracle for AI autonomous commerce agents
 * and logistics carriers on Celo.
 * Allows registered oracles to cryptographically attest to package fulfillment,
 * courier proof-of-delivery, and dispute inspection results.
 */
contract SokoAgentOracle {
    struct Attestation {
        bytes32 dealId;
        string trackingRef;
        string proofHash; // IPFS CID, carrier webhook confirmation hash, or signed payload
        address oracle;
        uint256 timestamp;
        bool verified;
    }

    address public owner;

    // Authorized oracles (AI agents, settlement daemons, carrier gateways)
    mapping(address => bool) public authorizedOracles;
    mapping(address => string) public oracleNames;

    // Deal delivery attestations
    mapping(bytes32 => Attestation) public attestations;
    bytes32[] public attestedDeals;

    event OracleRegistered(address indexed oracle, string name);
    event OracleRevoked(address indexed oracle);
    event DeliveryAttested(
        bytes32 indexed dealId,
        string trackingRef,
        string proofHash,
        address indexed oracle,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAuthorizedOracle() {
        require(authorizedOracles[msg.sender] || msg.sender == owner, "Not an authorized oracle");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedOracles[msg.sender] = true;
        oracleNames[msg.sender] = "SokoPay Protocol Genesis Oracle";
        emit OracleRegistered(msg.sender, "SokoPay Protocol Genesis Oracle");
    }

    /**
     * @notice Registers an authorized oracle agent
     */
    function registerOracle(address _oracle, string calldata _name) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle address");
        authorizedOracles[_oracle] = true;
        oracleNames[_oracle] = _name;
        emit OracleRegistered(_oracle, _name);
    }

    /**
     * @notice Revokes an authorized oracle agent
     */
    function revokeOracle(address _oracle) external onlyOwner {
        authorizedOracles[_oracle] = false;
        emit OracleRevoked(_oracle);
    }

    /**
     * @notice Submits an on-chain delivery attestation
     */
    function attestDelivery(
        bytes32 _dealId,
        string calldata _trackingRef,
        string calldata _proofHash
    ) external onlyAuthorizedOracle {
        require(_dealId != bytes32(0), "Invalid deal ID");

        attestations[_dealId] = Attestation({
            dealId: _dealId,
            trackingRef: _trackingRef,
            proofHash: _proofHash,
            oracle: msg.sender,
            timestamp: block.timestamp,
            verified: true
        });

        attestedDeals.push(_dealId);

        emit DeliveryAttested(_dealId, _trackingRef, _proofHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Checks if a deal has been certified delivered by an authorized oracle
     */
    function isDeliveryAttested(bytes32 _dealId) external view returns (bool verified, uint256 timestamp, address oracle, string memory proofHash) {
        Attestation memory att = attestations[_dealId];
        return (att.verified, att.timestamp, att.oracle, att.proofHash);
    }

    /**
     * @notice Returns total number of attested deals
     */
    function totalAttestations() external view returns (uint256) {
        return attestedDeals.length;
    }
}
