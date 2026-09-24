// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ContractorProofRegistry
/// @notice Records hashes and event references only. No documents, PII, or private terms.
contract ContractorProofRegistry {
    address public owner;

    mapping(address => bool) public recorders;
    mapping(bytes32 => bool) public projectExists;
    mapping(bytes32 => bool) public eventExists;

    event RecorderUpdated(address indexed recorder, bool authorized, uint256 timestamp);
    event ProjectRegistered(
        bytes32 indexed projectId,
        bytes32 indexed contractorId,
        uint256 timestamp
    );
    event VerificationRecorded(
        bytes32 indexed eventId,
        bytes32 indexed projectId,
        bytes32 milestoneId,
        bytes32 evidenceHash,
        bytes32 actorId,
        uint256 timestamp
    );
    event AttestationRecorded(
        bytes32 indexed eventId,
        bytes32 indexed projectId,
        bytes32 evidenceHash,
        bytes32 actorId,
        bool approved,
        uint256 timestamp
    );
    event CorrectionRecorded(
        bytes32 indexed eventId,
        bytes32 indexed previousEventId,
        bytes32 evidenceHash,
        bytes32 actorId,
        uint256 timestamp
    );
    event DisputeRecorded(
        bytes32 indexed eventId,
        bytes32 indexed previousEventId,
        bytes32 actorId,
        uint256 timestamp
    );
    event ResolutionRecorded(
        bytes32 indexed eventId,
        bytes32 indexed disputeEventId,
        bytes32 actorId,
        uint256 timestamp
    );
    event VariationRecorded(
        bytes32 indexed eventId,
        bytes32 indexed previousEventId,
        bytes32 variationRef,
        bytes32 actorId,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(msg.sender == owner || recorders[msg.sender], "not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
        recorders[msg.sender] = true;
        emit RecorderUpdated(msg.sender, true, block.timestamp);
    }

    function setRecorder(address recorder, bool authorized) external onlyOwner {
        require(recorder != address(0), "recorder required");
        recorders[recorder] = authorized;
        emit RecorderUpdated(recorder, authorized, block.timestamp);
    }

    function registerProject(bytes32 projectId, bytes32 contractorId) external onlyAuthorized {
        require(projectId != bytes32(0), "projectId required");
        require(contractorId != bytes32(0), "contractorId required");
        require(!projectExists[projectId], "project already registered");
        projectExists[projectId] = true;
        emit ProjectRegistered(projectId, contractorId, block.timestamp);
    }

    function recordVerification(
        bytes32 eventId,
        bytes32 projectId,
        bytes32 milestoneId,
        bytes32 evidenceHash,
        bytes32 actorId
    ) external onlyAuthorized {
        _markNewEvent(eventId);
        require(projectExists[projectId], "unknown project");
        require(evidenceHash != bytes32(0), "evidenceHash required");
        emit VerificationRecorded(
            eventId,
            projectId,
            milestoneId,
            evidenceHash,
            actorId,
            block.timestamp
        );
    }

    function recordAttestation(
        bytes32 eventId,
        bytes32 projectId,
        bytes32 evidenceHash,
        bytes32 actorId,
        bool approved
    ) external onlyAuthorized {
        _markNewEvent(eventId);
        require(projectExists[projectId], "unknown project");
        require(evidenceHash != bytes32(0), "evidenceHash required");
        emit AttestationRecorded(
            eventId,
            projectId,
            evidenceHash,
            actorId,
            approved,
            block.timestamp
        );
    }

    function recordCorrection(
        bytes32 eventId,
        bytes32 previousEventId,
        bytes32 evidenceHash,
        bytes32 actorId
    ) external onlyAuthorized {
        _markNewEvent(eventId);
        require(eventExists[previousEventId], "unknown previous event");
        emit CorrectionRecorded(eventId, previousEventId, evidenceHash, actorId, block.timestamp);
    }

    function recordDispute(
        bytes32 eventId,
        bytes32 previousEventId,
        bytes32 actorId
    ) external onlyAuthorized {
        _markNewEvent(eventId);
        require(eventExists[previousEventId], "unknown previous event");
        emit DisputeRecorded(eventId, previousEventId, actorId, block.timestamp);
    }

    function recordResolution(
        bytes32 eventId,
        bytes32 disputeEventId,
        bytes32 actorId
    ) external onlyAuthorized {
        _markNewEvent(eventId);
        require(eventExists[disputeEventId], "unknown dispute event");
        emit ResolutionRecorded(eventId, disputeEventId, actorId, block.timestamp);
    }

    function recordVariation(
        bytes32 eventId,
        bytes32 previousEventId,
        bytes32 variationRef,
        bytes32 actorId
    ) external onlyAuthorized {
        _markNewEvent(eventId);
        require(eventExists[previousEventId], "unknown previous event");
        require(variationRef != bytes32(0), "variationRef required");
        emit VariationRecorded(eventId, previousEventId, variationRef, actorId, block.timestamp);
    }

    function _markNewEvent(bytes32 eventId) private {
        require(eventId != bytes32(0), "eventId required");
        require(!eventExists[eventId], "event already recorded");
        eventExists[eventId] = true;
    }
}
