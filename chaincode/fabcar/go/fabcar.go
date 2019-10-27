package main

/* Imports
 * 4 utility libraries for formatting, handling bytes, reading and writing JSON, and string manipulation
 * 2 specific Hyperledger Fabric specific libraries for Smart Contracts
 */
import (
	"bytes"
	"time"

	//"crypto/sha256"
	"encoding/json"
	"fmt"
	//"strings"


	"github.com/hyperledger/fabric/core/chaincode/shim"
	sc "github.com/hyperledger/fabric/protos/peer"
	//"github.com/jmoiron/jsonq"
)

// Define the Smart Contract structure

type SmartContract struct {
}

// Define the car structure, with 4 properties.  Structure tags are used by encoding/json library
//type Car struct {
//	Make   string `json:"make"`
//	Model  string `json:"model"`
//	Colour string `json:"colour"`
//	Owner  string `json:"owner"`
//}
type User struct {
	// userId will give as key
	Cert string     `json:"cert"`
	PubKey string   `json:"pubkey"`
}
type Sensor struct {
	Doctype string
	DocID string
	PiID string
	Temp string
	Humidity string
}
var startTime time.Time
//type Key struct {
//	startKey string
//	endKey string
//}
/*
 * The Init method is called when the Smart Contract "fabcar" is instantiated by the blockchain network
 * Best practice is to have any Ledger initialization in separate function -- see initLedger()
 */
func (s *SmartContract) Init(APIstub shim.ChaincodeStubInterface) sc.Response {
	return shim.Success(nil)
}

/*
 * The Invoke method is called as a result of an application request to run the Smart Contract "fabcar"
 * The calling application program has also specified the particular smart contract function to be called, with arguments
 */
func (s *SmartContract) Invoke(APIstub shim.ChaincodeStubInterface) sc.Response {

	// Retrieve the requested Smart Contract function and arguments
	function, args := APIstub.GetFunctionAndParameters()
	// Route to the appropriate handler function to interact with the ledger appropriately
	if function == "initLedger" {
		return s.initLedger(APIstub)
	} else if function == "sensorData" {
		return s.sensorData(APIstub, args)
	} else if function == "lastData" {
		return  s.lastData(APIstub)
	} else if function == "queryAllData" {
		return s.queryAllData(APIstub)
	}else if function == "register" {
		return s.register(APIstub, args)
	}
	return shim.Error("Invalid Smart Contract function name.")
}


func (s *SmartContract) initLedger(APIstub shim.ChaincodeStubInterface) sc.Response {
	temp:="genesis"
	humidity:="genesis"
	piID:="genesis"
	docId:=time.Now().String()
	//docId:="12345"
	var sensor=Sensor{"SensorData",docId,piID,temp,humidity}
	fmt.Println("genesis block: ",sensor)
	sensorJSON,err:=json.Marshal(sensor)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = APIstub.PutState("0000genesis", sensorJSON)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success([]byte(sensorJSON))
}
func (s *SmartContract) register( APIstub shim.ChaincodeStubInterface, args []string ) sc.Response {

	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 3")
	}
	var user = User{ Cert: args[1],PubKey:args[2]  }
	fmt.Println(user)
	userAsBytes, _ := json.Marshal(user)
	APIstub.PutState(args[0], userAsBytes)

	return shim.Success(nil)

}

func (s *SmartContract) lastData(APIstub shim.ChaincodeStubInterface) sc.Response {
	dataQuery:=newCouchQueryBuilder().addSelector("Doctype","SensorData").getQueryString()
	data,_:=lastQueryValueForQueryString(APIstub,dataQuery)

	var sensorData Sensor
	_=json.Unmarshal(data,&sensorData)
	fmt.Println( "Sensordata ",sensorData)
	return shim.Success([]byte(data))

}
func (s *SmartContract) sensorData(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 2")
	}
	temp:=args[0]
	humidity:=args[1]
	piID:=args[2]
	docId:=time.Now().String()
	//docId:="12345"
	var sensor=Sensor{"SensorData",docId,piID,temp,humidity}
	fmt.Println(sensor)
	sensorJSON,err:=json.Marshal(sensor)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = APIstub.PutState(docId, sensorJSON)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success([]byte("docId : "+docId+"piID : "+piID+" temp : "+temp+" humidity : "+humidity))

}

// The main function is only relevant in unit test mode. Only included here for completeness.



func (s *SmartContract) queryAllData(APIstub shim.ChaincodeStubInterface ) sc.Response {

	startKey := startTime.String()
	endKey := time.Now().String()

	resultsIterator, err := APIstub.GetStateByRange(startKey, endKey)
	if err != nil {
		return shim.Error(err.Error())
	}
	defer resultsIterator.Close()

	// buffer is a JSON array containing QueryResults
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.Key)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Record\":")
		// Record is a JSON object, so we write as-is
		buffer.WriteString(string(queryResponse.Value))
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	fmt.Printf("- data are :\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}
func main() {

	// Create a new Smart Contract
	err := shim.Start(new(SmartContract))
	startTime=time.Now()
	if err != nil {
		fmt.Printf("Error creating new Smart Contract: %s", err)
	}
}

//func (s *SmartContract) changeCarOwner(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
//
//	if len(args) != 2 {
//		return shim.Error("Incorrect number of arguments. Expecting 2")
//	}
//
//	carAsBytes, _ := APIstub.GetState(args[0])
//	car := Car{}
//
//	json.Unmarshal(carAsBytes, &car)
//	car.Owner = args[1]
//
//	carAsBytes, _ = json.Marshal(car)
//	APIstub.PutState(args[0], carAsBytes)
//
//	return shim.Success(nil)
//}
//func (s *SmartContract) queryCar(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {
//
//	if len(args) != 1 {
//		return shim.Error("Incorrect number of arguments. Expecting 1")
//	}
//
//	carAsBytes, _ := APIstub.GetState(args[0])
//	return shim.Success(carAsBytes)
//}



