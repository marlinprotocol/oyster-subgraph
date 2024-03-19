import {
    JobOpened,
    JobSettled,
    JobClosed,
    JobDeposited,
    JobWithdrew,
    JobReviseRateInitiated,
    JobReviseRateCancelled,
    JobReviseRateFinalized,
    JobMetadataUpdated,
    ProviderAdded,
    ProviderRemoved,
    ProviderUpdatedWithCp,
    LockWaitTimeUpdated,
} from "../generated/MarketV1/MarketV1";

import { BigInt } from "@graphprotocol/graph-ts/common/numbers";
import { Job, SettlementHistory, DepositHistory, Provider, ReviseRateRequest, LockTime } from "../generated/schema";
import { log, store } from "@graphprotocol/graph-ts";

export const FEE_REVISE_LOCK_SELECTOR: string = "0xbb00c34f1a27e23493f1bd516e88ec0af9b091cc990f207e765f5bd5af012243";

export function handleJobOpened(event: JobOpened): void {
    const id = event.params.job.toHex();
    let job = Job.load(id);

    if (!job) {
        job = new Job(id);
    }

    job.metadata = event.params.metadata;
    job.owner = event.params.owner;
    job.provider = event.params.provider;
    job.rate = event.params.rate;
    job.balance = event.params.balance;
    job.lastSettled = event.params.timestamp;
    job.totalDeposit = event.params.balance;
    job.refund = BigInt.zero();
    job.createdAt = event.params.timestamp;

    job.save();

    const depositId = event.params.job.toHex() + event.transaction.hash.toHexString() + "deposit";
    let depositInstance = DepositHistory.load(depositId);
    if (!depositInstance) {
        depositInstance = new DepositHistory(depositId);
        depositInstance.job = id;
        depositInstance.timestamp = event.block.timestamp;
        depositInstance.amount = BigInt.zero();
        depositInstance.isWithdrawal = false;
        depositInstance.txHash = event.transaction.hash;
    }
    depositInstance.amount = depositInstance.amount.plus(event.params.balance);
    depositInstance.save();
}

export function handleJobDeposited(event: JobDeposited): void {
    const id = event.params.job.toHex();
    let job = Job.load(id);

    if (!job) {
        log.error("Deposited for non existent job id {}", [id]);
        return;
    }
    job.balance = job.balance.plus(event.params.amount);
    job.totalDeposit = job.totalDeposit.plus(event.params.amount);
    job.save();

    const depositId = id + event.block.timestamp.toString() + "deposit";
    let depositInstance = DepositHistory.load(depositId);
    if (!depositInstance) {
        depositInstance = new DepositHistory(depositId);
        depositInstance.job = id;
        depositInstance.timestamp = event.block.timestamp;
        depositInstance.amount = BigInt.zero();
        depositInstance.isWithdrawal = false;
        depositInstance.txHash = event.transaction.hash;
    }
    depositInstance.amount = depositInstance.amount.plus(event.params.amount);
    depositInstance.save();
}

export function handleJobClosed(event: JobClosed): void {
    const id = event.params.job.toHex();
    let job = Job.load(id);

    if (!job) {
        log.error("Closed non existent job with id {}", [id]);
        return;
    }

    job.refund = job.balance;
    job.balance = BigInt.zero();
    job.save();

    const withdrawId = id + event.block.timestamp.toString() + "withdraw";
    let withdrawInstance = DepositHistory.load(withdrawId);
    if (!withdrawInstance) {
        withdrawInstance = new DepositHistory(withdrawId);
        withdrawInstance.job = id;
        withdrawInstance.timestamp = event.block.timestamp;
        withdrawInstance.amount = BigInt.zero();
        withdrawInstance.isWithdrawal = true;
        withdrawInstance.txHash = event.transaction.hash;
    }
    withdrawInstance.amount = withdrawInstance.amount.plus(job.balance);
    withdrawInstance.save();
}

export function handleJobReviseRateInitiated(event: JobReviseRateInitiated): void {
    const id = event.params.job.toHex();
    let request = ReviseRateRequest.load(id);

    if (!request) {
        request = new ReviseRateRequest(id);
    }

    request.job = event.params.job.toHex();
    request.value = event.params.newRate;
    request.updatesAt = event.block.timestamp;

    let lockTime = LockTime.load(FEE_REVISE_LOCK_SELECTOR);

    if (lockTime) {
        request.updatesAt = event.block.timestamp.plus(lockTime.value);
    }

    request.status = "IN_PROGRESS";

    request.save();
}

export function handleJobReviseRateCancelled(event: JobReviseRateCancelled): void {
    const id = event.params.job.toHex();
    let request = ReviseRateRequest.load(id);

    if (!request) {
        return;
    }

    request.status = "CANCELLED";

    request.save();
}

export function handleJobReviseRateFinalized(event: JobReviseRateFinalized): void {
    const id = event.params.job.toHex();

    let request = ReviseRateRequest.load(id);

    if (!request) {
        return;
    }

    request.status = "COMPLETED";

    request.save();

    const job = Job.load(id);

    if (!job) {
        return
    }

    job.rate = event.params.newRate;
    job.save();
}

export function handleJobSettled(event: JobSettled): void {
    const id = event.params.job.toHex();
    const job = Job.load(id);

    if (!job) {
        return
    }
    const amount = event.params.amount;
    if (amount.gt(job.balance)) {
        log.error("Job Settled for amount {} while balance is {}", [amount.toString(), job.balance.toString()]);
        job.balance = BigInt.zero();
    } else {
        job.balance = job.balance.minus(amount);
    }

    job.lastSettled = event.block.timestamp;
    job.save();

    let settlementId = id + event.block.timestamp.toString();
    let settlement = SettlementHistory.load(settlementId);

    if (settlement) {
        return;
    }

    settlement = new SettlementHistory(settlementId);
    settlement.job = id;
    settlement.timestamp = event.block.timestamp;
    settlement.amount = amount;
    settlement.txHash = event.transaction.hash;

    settlement.save();
}

export function handleJobWithdrew(event: JobWithdrew): void {
    const id = event.params.job.toHex();
    const job = Job.load(id);

    if (!job) {
        return
    }

    const amount = event.params.amount;
    job.balance = job.balance.minus(amount);
    job.totalDeposit = job.totalDeposit.minus(amount);
    job.save();

    const withdrawId = id + event.block.timestamp.toString() + "withdraw";
    let withdrawInstance = DepositHistory.load(withdrawId);
    if (!withdrawInstance) {
        withdrawInstance = new DepositHistory(withdrawId);
        withdrawInstance.job = id;
        withdrawInstance.timestamp = event.block.timestamp;
        withdrawInstance.amount = BigInt.zero();
        withdrawInstance.isWithdrawal = true;
        withdrawInstance.txHash = event.transaction.hash;
    }
    withdrawInstance.amount = withdrawInstance.amount.plus(amount);
    withdrawInstance.save();
}

export function handleJobMetadataUpdated(event: JobMetadataUpdated): void {
    const id = event.params.job.toHex();
    const job = Job.load(id);

    if (!job) {
        return
    }

    job.metadata = event.params.metadata;
    job.save();
}

export function handleProviderAdded(event: ProviderAdded): void {
    const id = event.params.provider.toHex();
    const provider = new Provider(id);

    provider.cp = event.params.cp;
    provider.live = true;
    provider.save();
}

export function handleProviderRemoved(event: ProviderRemoved): void {
    const id = event.params.provider.toHex();
    const provider = Provider.load(id);

    if (!provider) {
        return
    } else {
        store.remove("Provider", id);
    }
}

export function handleProviderUpdatedWithCp(event: ProviderUpdatedWithCp): void {
    const id = event.params.provider.toHex();
    const provider = Provider.load(id);

    if (!provider) {
        return
    } else {
        provider.cp = event.params.newCp;
        provider.save();
    }
}

export function handleLockWaitTimeUpdated(event: LockWaitTimeUpdated): void {
    const id = event.params.selector.toHexString();
    let lockTime = LockTime.load(id);

    if (!lockTime) {
        lockTime = new LockTime(id);
    }

    lockTime.id = id;
    lockTime.value = event.params.updatedLockTime;
    lockTime.save();
}
