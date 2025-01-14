package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/jmoiron/jsonq"
)

type QueryResponse struct {
	Key    string
	Record []byte
	Query  *jsonq.JsonQuery
}

//func firstQueryValueForQueryString(stub shim.ChaincodeStubInterface, queryString string) ([]byte, error) {
//	resultsIterator, err := stub.GetQueryResult(queryString)
//	if err != nil {
//		return nil, err
//	}
//	defer closeIterator(resultsIterator)
//
//	if resultsIterator.HasNext() {
//		data, _ := resultsIterator.Next()
//		return data.Value, nil
//	}
//
//	return []byte(""), nil
//}
func lastQueryValueForQueryString(stub shim.ChaincodeStubInterface, queryString string) ([]byte, error) {
	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer closeIterator(resultsIterator)

	 x,_:=resultsIterator.Next()
	for resultsIterator.HasNext() {
		x,_=resultsIterator.Next()


	}

	if !resultsIterator.HasNext() {
		fmt.Println(x)
		return x.Value, nil
	}

	return []byte(""), nil
}
func allPiQueryValueForQueryString(stub shim.ChaincodeStubInterface, queryString string) ([]byte, error) {
	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer closeIterator(resultsIterator)
	arr:=[]Pi{}

	x,_:=resultsIterator.Next()

	for resultsIterator.HasNext() {
		var piData Pi
		_=json.Unmarshal(x.Value,&piData)
		arr=append(arr,piData)
		x,_=resultsIterator.Next()

	}
	var piData Pi
	_=json.Unmarshal(x.Value,&piData)
	arr=append(arr,piData)
	fmt.Println("ALL array of pi ")
	fmt.Println(arr)
	resultArrjson,_:=json.Marshal(arr)
	fmt.Println("Inside all Value for query String")
	fmt.Println((resultArrjson))

	return (resultArrjson), nil
}

func decodeSingleResponse(jsonResponse []byte) *QueryResponse {
	data := map[string]interface{}{}
	dec := json.NewDecoder(strings.NewReader(string(jsonResponse)))
	err := dec.Decode(&data)
	if err != nil {
		fmt.Println(err.Error())
	}
	jq := jsonq.NewQuery(data)

	key, err := jq.String("Key")
	if err != nil {
		fmt.Println(err.Error())
	}
	record, err := jq.String("Record")
	if err != nil {
		fmt.Println(err.Error())
	}
	recordByteArray := []byte(record)

	return &QueryResponse{Key: key, Record: recordByteArray, Query: jq}
}

func getJSONQueryResultForQueryString(stub shim.ChaincodeStubInterface, queryString string) ([]byte, error) {
	start := "{\"values\": "
	end := "}"
	data, err := getQueryResultForQueryString(stub, queryString)
	if err != nil {
		return nil, err
	}
	return []byte(start + string(data) + end), nil
}

// =========================================================================================
// getQueryResultForQueryString executes the passed in query string.
// Result set is built and returned as a byte array containing the JSON results.
// =========================================================================================
func getQueryResultForQueryString(stub shim.ChaincodeStubInterface, queryString string) ([]byte, error) {

	fmt.Printf("- getQueryResultForQueryString queryString:\n%s\n", queryString)

	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer closeIterator(resultsIterator)

	buffer, err := constructQueryResponseFromIterator(resultsIterator)
	if err != nil {
		return nil, err
	}

	fmt.Printf("- getQueryResultForQueryString queryResult:\n%s\n", buffer.String())

	return buffer.Bytes(), nil
}

// ===========================================================================================
// constructQueryResponseFromIterator constructs a JSON array containing query results from
// a given result iterator
// ===========================================================================================
func constructQueryResponseFromIterator(resultsIterator shim.StateQueryIteratorInterface) (*bytes.Buffer, error) {
	// buffer is a JSON array containing QueryResults
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
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

	return &buffer, nil
}

func firstQueryResultForQueryString(stub shim.ChaincodeStubInterface, queryString string) ([]byte, error) {

	fmt.Printf("- getQueryResultForQueryString queryString:\n%s\n", queryString)

	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer closeIterator(resultsIterator)

	buffer, err := firstQueryResponseFromIterator(resultsIterator)
	if err != nil {
		return nil, err
	}

	fmt.Printf("- getQueryResultForQueryString queryResult:\n%s\n", buffer.String())

	return buffer.Bytes(), nil
}

func closeIterator(resultsIterator shim.StateQueryIteratorInterface) {
	err := resultsIterator.Close()
	if err != nil {
		fmt.Println(err.Error())
	}
}

// ===========================================================================================
// firstQueryResponseFromIterator returns query results from
// a given result iterator
// ===========================================================================================
func firstQueryResponseFromIterator(resultsIterator shim.StateQueryIteratorInterface) (*bytes.Buffer, error) {
	// buffer is a JSON array containing QueryResults
	var buffer bytes.Buffer

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
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

		break
	}

	return &buffer, nil
}
